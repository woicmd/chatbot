# app/tools/debugger_evaluator.py
from app.schemas.state_schema import AgentState, ExecutionTrace
from app.schemas.diff_schema import RefactorResponse
from app.adapters.llm import generate_plan
from app.memory.store import record_failure
from app.core.logger import log_event
import json

MAX_REFLEXION_ATTEMPTS = 3

EVALUATOR_SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "You are a Principal SRE Evaluator operating under the AgentRx framework.\n"
        "You receive:\n"
        "  1. A debugging hypothesis (expected root cause and expected state).\n"
        "  2. Actual sandbox execution output from probe injection.\n\n"
        "Your strict procedure:\n"
        "  A. Compare expected_state vs actual sandbox output line by line.\n"
        "  B. If hypothesis is CONFIRMED (actual matches expected failure pattern): "
        "     set status=success and generate a precise XML diff patch to fix the root cause.\n"
        "  C. If hypothesis is REFUTED (actual diverges from expected): "
        "     set status=failure, explain the divergence in reasoning_trace, "
        "     leave diff_payload empty.\n\n"
        "DO NOT generate a patch unless the sandbox data directly confirms the hypothesis. "
        "Output must conform to the RefactorResponse JSON schema."
    )
}


async def execute_debugger_evaluator(state: AgentState) -> AgentState:
    hypothesis_context = json.dumps(state.ast_context or {}, indent=2)

    # Extract latest sandbox output from message history
    sandbox_output = "[No sandbox output found]"
    for msg in reversed(state.messages):
        if "<sandbox_output>" in msg.get("content", ""):
            sandbox_output = msg["content"]
            break

    eval_prompt = {
        "role": "user",
        "content": (
            f"<hypothesis>\n{hypothesis_context}\n</hypothesis>\n\n"
            f"<sandbox_output>\n{sandbox_output}\n</sandbox_output>\n\n"
            "Evaluate: does the sandbox output confirm or refute the hypothesis? "
            "Generate a fix patch only if confirmed."
        )
    }

    messages = [EVALUATOR_SYSTEM_PROMPT] + state.messages + [eval_prompt]

    try:
        response_data = await generate_plan(messages, schema=RefactorResponse)

        if isinstance(response_data, RefactorResponse):
            eval_status = response_data.status
            diff_blocks = response_data.diff_payload
            reasoning = response_data.reasoning_trace
        else:
            eval_status = response_data.get("status", "failure")
            diff_blocks = response_data.get("diff_payload", [])
            reasoning = response_data.get("reasoning_trace", "No reasoning provided.")

        if eval_status == "success" and diff_blocks:
            state.diff_payload = list(diff_blocks)
            f"Fix patch generated:\n```json\n{json.dumps([b.model_dump() for b in state.diff_payload], indent=2)}\n```"
            
            state.messages.append({
                "role": "assistant",
                "content": (
                    f"[AgentRx Evaluator] Hypothesis CONFIRMED via sandbox observation.\n"
                    f"Reasoning: {reasoning}\n\n"
                    f"Fix patch generated:\n```json\n{json.dumps([b.model_dump() for b in state.diff_payload], indent=2)}\n```"
                )
            })
            log_event("debugger_evaluator", {"status": "confirmed", "patches": len(diff_blocks)})
            state.execution_trace.append(ExecutionTrace(node_name="debugger_evaluator", status="confirmed"))
            state.next_node = "end"

        else:
            # Hypothesis refuted → Reflexion: re-hypothesize with new context
            state.reflexion_attempt += 1
            failure_summary = f"Hypothesis refuted. Divergence: {reasoning}"
            state = record_failure(state, "debugger_evaluator", failure_summary)

            log_event("debugger_evaluator", {
                "status": "refuted",
                "attempt": state.reflexion_attempt,
                "reasoning": reasoning[:120]
            })
            state.execution_trace.append(ExecutionTrace(
                node_name="debugger_evaluator",
                status="refuted",
                error_log=failure_summary
            ))

            if state.reflexion_attempt < MAX_REFLEXION_ATTEMPTS:
                state.messages.append({
                    "role": "assistant",
                    "content": (
                        f"[AgentRx Evaluator] Hypothesis REFUTED (Attempt {state.reflexion_attempt}).\n"
                        f"Divergence: {reasoning}\n"
                        "Reformulating hypothesis with updated context..."
                    )
                })
                state.next_node = "debugger"  # Reflexion: back to re-hypothesize
            else:
                state.messages.append({
                    "role": "assistant",
                    "content": (
                        f"[AgentRx] Maximum reflexion depth ({MAX_REFLEXION_ATTEMPTS}) reached. "
                        "Root cause could not be isolated automatically. Manual investigation required.\n"
                        f"Last reasoning: {reasoning}"
                    )
                })
                state.next_node = "end"

    except Exception as e:
        log_event("debugger_evaluator", {"status": "failed", "error": str(e)})
        state.execution_trace.append(ExecutionTrace(
            node_name="debugger_evaluator",
            status="failed",
            error_log=str(e)
        ))
        state.messages.append({"role": "assistant", "content": f"[Evaluator Error]: {str(e)}"})
        state.next_node = "end"

    return state
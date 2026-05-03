from app.schemas.state_schema import AgentState, ExecutionTrace
from app.schemas.diff_schema import RefactorResponse
from app.adapters.llm import generate_plan, _wrap_thinking
from app.core.diff_applier import parse_xml_diff_blocks, apply_xml_diff
from app.memory.store import record_failure, build_reflexion_context
from app.core.logger import log_event
import json

MAX_REFLEXION_ATTEMPTS = 3

REFACTORER_SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "You are a Principal Software Engineer executing a structured refactoring engagement.\n\n"
        "[PHASE 1 — SMELL DETECTION]\n"
        "Before generating any diff, audit the provided AST context for the following:\n"
        "  Architectural Smells: Cyclic Dependencies, God Component, Ambiguous Interface.\n"
        "  Implementation Smells: Duplicate Code, Primitive Obsession, Long Method, Feature Envy.\n"
        "State each smell found with its exact location.\n\n"
        "[PHASE 2 — PATTERN SELECTION]\n"
        "For each smell, select the appropriate refactoring pattern:\n"
        "  God Component         → Extract Class / Extract Service (Single Responsibility Principle).\n"
        "  Ambiguous Interface   → Apply Strategy Pattern (polymorphic action hierarchy).\n"
        "  Cyclic Dependency     → Introduce Mediator or shared Domain Events library.\n"
        "  Primitive Obsession   → Replace with Value Objects that encapsulate validation.\n"
        "  Duplicate Code        → Extract Method / Extract Module.\n\n"
        "[PHASE 3 — DIFF GENERATION]\n"
        "Produce the resolution strictly in the standard <search> and <replace> XML diff format.\n"
        "Each <search> block must contain the EXACT original text including all whitespace.\n"
        "Ensure exact indentation matching. Do not guess line numbers.\n\n"
        "[PHASE 4 — IMPACT ESTIMATE]\n"
        "In your reasoning_trace, include an estimated impact on:\n"
        "  - Cyclomatic Complexity (McCabe): expected reduction.\n"
        "  - Afferent Coupling: expected reduction.\n"
        "  - Testability: qualitative improvement.\n\n"
        "You do not output pleasantries or filler. Every output is engineering-grounded."
    )
}


async def execute_refactorer(state: AgentState) -> AgentState:
    if state.reflexion_attempt >= MAX_REFLEXION_ATTEMPTS:
        state.messages.append({
            "role": "assistant",
            "content": (
                f"[Refactorer] Maximum reflexion attempts ({MAX_REFLEXION_ATTEMPTS}) reached. "
                "Diff application failed. Manual review required."
            )
        })
        state.next_node = "end"
        return state

    ast_context_str = json.dumps(state.ast_context) if state.ast_context else "No AST provided."
    reflexion_context = build_reflexion_context(state)

    context_prompt = {
        "role": "user",
        "content": (
            f"<ast_context>\n{ast_context_str}\n</ast_context>"
            f"{reflexion_context}\n\n"
            "Execute the four-phase refactoring protocol and generate the XML diff payload."
        )
    }

    messages = [REFACTORER_SYSTEM_PROMPT] + state.messages + [context_prompt]

    try:
        response_data, reasoning = await generate_plan(
            messages, schema=RefactorResponse, api_key=state.api_key, return_reasoning=True
        )

        if isinstance(response_data, RefactorResponse):
            diff_blocks = response_data.diff_payload
            reasoning_trace = response_data.reasoning_trace
            status = response_data.status
        else:
            diff_blocks = response_data.get("diff_payload", [])
            reasoning_trace = response_data.get("reasoning_trace", "")
            status = response_data.get("status", "success")

        state.diff_payload = list(diff_blocks)

        applied = []
        errors = []

        for block in diff_blocks:
            file_path = block.file_path
            content = block.content

            pairs = parse_xml_diff_blocks(content)
            if not pairs:
                errors.append(f"No valid <search>/<replace> pairs found in block for {file_path}")
                continue

            for pair in pairs:
                if pair["search"] and pair["replace"]:
                    applied.append(f"✓ {file_path}: diff structure valid (apply skipped — no source file)")
                else:
                    errors.append(f"✗ {file_path}: empty search or replace block")

        if errors:
            state.reflexion_attempt += 1
            failure_summary = f"Diff validation errors: {'; '.join(errors)}"
            state = record_failure(state, "refactorer", failure_summary)

            log_event("refactorer", {"status": "reflexion", "attempt": state.reflexion_attempt, "errors": errors})
            state.execution_trace.append(ExecutionTrace(
                node_name="refactorer",
                status="reflexion",
                error_log=failure_summary
            ))
            state.next_node = "refactorer"

        else:
            result_lines = "\n".join(applied) if applied else "(No file paths to apply — diff payload validated only)"
            diff_json = json.dumps([b.model_dump() for b in state.diff_payload], indent=2)
            raw_content = (
                f"[Refactorer] Completed after {state.reflexion_attempt + 1} attempt(s).\n"
                f"Reasoning & Impact Estimate:\n{reasoning_trace}\n\n"
                f"Applied patches:\n{result_lines}\n\n"
                f"Diff payload:\n```json\n{diff_json}\n```"
            )
            state.messages.append({
                "role": "assistant",
                "content": _wrap_thinking(reasoning, raw_content)
            })
            log_event("refactorer", {"status": "success", "patches": len(applied)})
            state.execution_trace.append(ExecutionTrace(node_name="refactorer", status="success"))
            state.next_node = "end"

    except Exception as e:
        state.reflexion_attempt += 1
        state = record_failure(state, "refactorer", str(e))

        log_event("refactorer", {"status": "exception", "attempt": state.reflexion_attempt, "error": str(e)})
        state.execution_trace.append(ExecutionTrace(
            node_name="refactorer",
            status="schema_validation_failed",
            error_log=str(e)
        ))

        if state.reflexion_attempt < MAX_REFLEXION_ATTEMPTS:
            state.next_node = "refactorer"
        else:
            state.messages.append({
                "role": "assistant",
                "content": f"[Refactorer] Failed after {state.reflexion_attempt} attempts: {str(e)}"
            })
            state.next_node = "end"

    return state
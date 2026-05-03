from app.schemas.state_schema import AgentState, ExecutionTrace
from app.schemas.debugger_schema import DebuggingHypothesis
from app.adapters.llm import generate_plan, _wrap_thinking
from app.memory.store import build_reflexion_context
from app.core.logger import log_event
import json

DEBUGGER_SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "You are a Principal SRE and Debugging Specialist. You do not guess. You observe, then act.\n\n"
        "[STEP 1 — USE METHOD ANALYSIS]\n"
        "For each suspected component, evaluate:\n"
        "  Utilization  : Is the resource being used near its capacity limit?\n"
        "  Saturation   : Is there a queue or backlog forming?\n"
        "  Errors        : Are error rates elevated at this component boundary?\n\n"
        "[STEP 2 — 5 WHYS ROOT CAUSE DRILL]\n"
        "Starting from the observed symptom, apply the 5 Whys iteratively:\n"
        "  Why is [symptom] occurring? → Because [cause_1].\n"
        "  Why is [cause_1] occurring? → Because [cause_2].\n"
        "  Continue until the structural root cause is reached (max 5 levels).\n\n"
        "[STEP 3 — ISHIKAWA CATEGORIZATION]\n"
        "Classify the root cause under one of the standard Fishbone categories:\n"
        "  Methods   : Configuration, process, or algorithmic fault.\n"
        "  Machines  : Hardware or infrastructure constraint.\n"
        "  Measurement : Observability gap masking the true signal.\n"
        "  People    : Glossary mismatch or operational procedure failure.\n\n"
        "[STEP 4 — TIERED REMEDIATION PLAN]\n"
        "Produce exactly three remediation tiers:\n"
        "  Minimal Fix   : Immediate configuration or parameter change. Low risk. Fast.\n"
        "  Robust Fix    : Structural code or infrastructure change. Addresses root cause.\n"
        "  Preventive    : SLO-as-Code gate, Chaos Engineering drill, or alerting improvement.\n\n"
        "[STEP 5 — LOG PROBE SPECIFICATION]\n"
        "Specify precise log probes to inject at suspected failure boundaries for sandbox validation.\n"
        "Do NOT generate a final fix diff here — that belongs to the Evaluator after probe observation.\n\n"
        "Output your full analysis in the required DebuggingHypothesis JSON schema.\n"
        "State confidence level (High / Medium / Low) for each hypothesis."
    )
}


async def execute_debugger(state: AgentState) -> AgentState:
    recent_errors = [t for t in state.execution_trace if t.status == "failed"]
    error_context = json.dumps([e.model_dump() for e in recent_errors])
    reflexion_context = build_reflexion_context(state)

    prompt = {
        "role": "user",
        "content": (
            f"<execution_trace>\n{error_context}\n</execution_trace>"
            f"{reflexion_context}\n\n"
            "Execute the five-step debugging protocol. "
            "Formulate your falsifiable hypothesis and specify probes for sandbox injection."
        )
    }

    messages = [DEBUGGER_SYSTEM_PROMPT] + state.messages + [prompt]

    try:
        hypothesis_data, reasoning = await generate_plan(
            messages, schema=DebuggingHypothesis, api_key=state.api_key, return_reasoning=True
        )

        if isinstance(hypothesis_data, DebuggingHypothesis):
            hypothesis_text = hypothesis_data.root_cause_hypothesis
            state.ast_context = {"hypothesis": hypothesis_data.model_dump()}
        else:
            hypothesis_text = hypothesis_data.get("root_cause_hypothesis", "Unknown")
            state.ast_context = {"hypothesis": hypothesis_data}

        raw_content = (
            f"[AgentRx] Hypothesis formulated: {hypothesis_text}\n"
            "Tiered remediation plan generated. Probes ready for sandbox injection. "
            "Routing to microVM evaluator."
        )
        state.messages.append({
            "role": "assistant",
            "content": _wrap_thinking(reasoning, raw_content)
        })

        log_event("debugger", {"status": "success", "hypothesis": hypothesis_text[:120]})
        state.execution_trace.append(ExecutionTrace(node_name="debugger", status="success"))
        state.next_node = "sandbox_evaluator"

    except Exception as e:
        log_event("debugger", {"status": "failed", "error": str(e)})
        state.execution_trace.append(
            ExecutionTrace(node_name="debugger", status="failed", error_log=str(e))
        )
        state.messages.append({"role": "assistant", "content": f"[Debugger Error]: {str(e)}"})
        state.next_node = "respond"

    return state
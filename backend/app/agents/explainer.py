from app.adapters.llm import generate_plan, _wrap_thinking
from app.schemas.state_schema import AgentState, ExecutionTrace
from app.core.logger import log_event

EXPLAINER_SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "You are a Principal Software Engineer acting as a technical mentor. "
        "You are the ONLY agent in this system permitted to output detailed natural language explanations.\n\n"
        "[OUTPUT STRUCTURE]\n"
        "Every explanation must follow this exact sequence:\n"
        "  1. Concept          : Name and one-sentence definition.\n"
        "  2. Why It Exists    : The engineering problem it solves. Reference historical context where relevant.\n"
        "  3. How It Works     : Mechanistic breakdown. Reference specific design patterns (e.g., Strategy, Observer, CQRS).\n"
        "  4. Trade-off Matrix : Apply the ATAM framework. Evaluate the concept against: Performance, Scalability, "
        "Consistency, Maintenance Overhead, and Infrastructure Cost. Use a markdown table.\n"
        "  5. Example          : A concrete, minimal code or system example that illustrates the core mechanism.\n\n"
        "[EPISTEMIC HUMILITY RULE]\n"
        "If any aspect of the explanation involves a debated topic, an emerging standard, or an empirically contested claim, "
        "you must explicitly state the confidence level (High / Medium / Low) and present the opposing viewpoint.\n\n"
        "[STRICT RULES]\n"
        "Do NOT use emojis. Keep tone professional and precise. Use markdown for structure. "
        "Reference Golden Signals (Latency, Traffic, Errors, Saturation) when explaining observability-related concepts. "
        "Zero filler. Every sentence must carry engineering information density."
    )
}


async def execute_explainer(state: AgentState) -> AgentState:
    messages = [EXPLAINER_SYSTEM_PROMPT] + state.messages

    try:
        response, reasoning = await generate_plan(messages, api_key=state.api_key, return_reasoning=True)
        raw_content = (
            response.get("output", str(response))
            if isinstance(response, dict)
            else str(response)
        )
        content = _wrap_thinking(reasoning, raw_content)

        state.messages.append({"role": "assistant", "content": content})
        log_event("explainer", {"status": "success"})
        state.execution_trace.append(ExecutionTrace(node_name="explainer", status="success"))
        state.next_node = "end"

    except Exception as e:
        log_event("explainer", {"status": "failed", "error": str(e)})
        state.execution_trace.append(
            ExecutionTrace(node_name="explainer", status="failed", error_log=str(e))
        )
        state.messages.append({"role": "assistant", "content": f"[Explainer Error]: {str(e)}"})
        state.next_node = "end"

    return state
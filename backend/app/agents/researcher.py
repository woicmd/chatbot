from app.adapters.llm import generate_plan, _wrap_thinking
from app.schemas.state_schema import AgentState, ExecutionTrace
from app.schemas.researcher_schema import DeepResearchProposal
from app.core.logger import log_event

RESEARCHER_SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "You are 'DeepThought', an elite Principal Research Analyst and Polymath. "
        "You operate purely on logic, empirical evidence, and first principles. "
        "You do not hallucinate facts. You ruthlessly verify your own reasoning.\n\n"
        "[COGNITIVE PROTOCOL — EXECUTE IN ORDER]\n\n"
        "1. [DECONSTRUCTION]\n"
        "   Break the query into fundamental sub-questions. "
        "   Explicitly state any assumptions embedded in the question itself.\n\n"
        "2. [HYPOTHESIS GENERATION]\n"
        "   Formulate 2-3 competing hypotheses or angles of approach. "
        "   Do not commit to one yet.\n\n"
        "3. [EVIDENCE GATHERING & SYNTHESIS]\n"
        "   For each hypothesis, gather concrete facts, technical data, historical context, "
        "   and contrasting viewpoints from your knowledge base.\n\n"
        "4. [ADVERSARIAL CRITIQUE — MANDATORY]\n"
        "   Aggressively attack your own findings. For each key claim, ask:\n"
        "     - What evidence would falsify this?\n"
        "     - What biases or selection effects might be inflating this conclusion?\n"
        "     - What is the strongest opposing argument?\n"
        "   Assign a confidence level to each surviving claim: High (>80%), Medium (40-80%), Low (<40%).\n\n"
        "5. [FMEA-STYLE RISK FRAMING — where applicable]\n"
        "   For research involving systems, decisions, or strategies, produce a risk table:\n"
        "     Risk | Probability (1-10) | Impact (1-10) | RPN | Mitigation\n\n"
        "6. [SYNTHESIS]\n"
        "   Reconstruct verified information into a cohesive, highly structured, actionable final report. "
        "   Use markdown with clear section headers.\n\n"
        "[OUTPUT PROTOCOL]\n"
        "Place your internal reasoning in the 'reasoning' field. "
        "Place the final synthesized markdown report in the 'research_report' field.\n\n"
        "[STRICT RULES]\n"
        "Zero filler. No pleasantries. "
        "Every uncertain or debated claim must carry its confidence level inline. "
        "Use exact terminology, metrics, and technical language. "
        "Prefer primary sources and first-principles derivations over secondary aggregators."
    )
}

async def execute_researcher(state: AgentState) -> AgentState:
    messages = [RESEARCHER_SYSTEM_PROMPT] + state.messages

    try:
        response, reasoning = await generate_plan(
            messages, schema=DeepResearchProposal, api_key=state.api_key, return_reasoning=True
        )

        if isinstance(response, DeepResearchProposal):
            raw_content = (
                f"```reasoning\n"
                f"{response.reasoning}\n"
                f"```\n\n"
                f"{response.research_report}"
            )
        else:
            raw_content = response.get("output", str(response)) if isinstance(response, dict) else str(response)

        content = _wrap_thinking(reasoning, raw_content)

        state.messages.append({"role": "assistant", "content": content})
        log_event("researcher", {"status": "success"})
        state.execution_trace.append(ExecutionTrace(node_name="researcher", status="success"))
        state.next_node = "end"

    except Exception as e:
        log_event("researcher", {"status": "failed", "error": str(e)})
        state.execution_trace.append(ExecutionTrace(node_name="researcher", status="failed", error_log=str(e)))
        state.messages.append({"role": "assistant", "content": f"[Researcher Error]: {str(e)}"})
        state.next_node = "end"

    return state
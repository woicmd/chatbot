from app.adapters.llm import generate_plan, _wrap_thinking
from app.schemas.state_schema import AgentState, ExecutionTrace
from app.schemas.architect_schema import SystemDesignProposal
from app.core.logger import log_event

ARCHITECT_SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "You are an expert System Architect operating under a rigorous architectural methodology. "
        "Every response is engineering-grounded. Zero pleasantries.\n\n"
        "[PHASE 1 — REQUIREMENT DECOMPOSITION]\n"
        "Decompose requirements into Functional Requirements (FR) and Non-Functional Requirements (NFR). "
        "NFRs are primary architectural drivers. Quantify them: latency targets (P99), availability SLOs, "
        "scalability multipliers (e.g., 10x peak), and security benchmarks (e.g., OWASP Top 10).\n\n"
        "[PHASE 2 — C4 MODEL HIERARCHY]\n"
        "Structure all system descriptions according to the C4 model levels:\n"
        "  L1 Context   : System boundary and external actors.\n"
        "  L2 Container : Deployable services and data stores with communication protocols.\n"
        "  L3 Component : Internal modules within each container and their dependencies.\n"
        "Always include a valid Mermaid.js diagram at the most appropriate C4 level.\n\n"
        "[PHASE 3 — SPOF AND FMEA ANALYSIS]\n"
        "Identify all Single Points of Failure. For each failure mode, produce an FMEA risk table:\n"
        "  Columns: Failure Mode | Impact (1-10) | Occurrence (1-10) | Detection (1-10) | RPN | Mitigation\n"
        "  RPN = Impact × Occurrence × Detection. Prioritize mitigations by highest RPN.\n"
        "  Mandatory mitigation patterns: Circuit Breaker for cascading failures, "
        "multi-region failover for stateful components.\n\n"
        "[PHASE 4 — TRADE-OFF MATRIX]\n"
        "Apply the ATAM framework. Evaluate the proposed architecture against:\n"
        "  Scalability, Latency, Consistency, Maintenance Overhead, and Infrastructure Cost.\n\n"
        "[PHASE 5 — ADR GENERATION]\n"
        "For each significant architectural decision, produce an Architectural Decision Record (ADR):\n"
        "  Title | Status | Context | Decision | Consequences\n\n"
        "Output must conform exactly to the SystemDesignProposal JSON schema."
    )
}


async def execute_architect(state: AgentState) -> AgentState:
    messages = [ARCHITECT_SYSTEM_PROMPT] + state.messages

    try:
        response, reasoning = await generate_plan(
            messages, schema=SystemDesignProposal, api_key=state.api_key, return_reasoning=True
        )

        if isinstance(response, SystemDesignProposal):
            t = response.tradeoff_evaluation
            raw_content = (
                f"[Architect] System Design Proposal\n\n"
                f"**Summary:** {response.architecture_summary}\n\n"
                f"**Trade-off Matrix (ATAM):**\n"
                f"| Dimension | Evaluation |\n"
                f"|-----------|------------|\n"
                f"| Scalability | {t.scalability} |\n"
                f"| Latency | {t.latency} |\n"
                f"| Consistency | {t.consistency} |\n"
                f"| Maintenance | {t.maintenance_overhead} |\n"
                f"| Cost | {t.infrastructure_cost} |\n\n"
                f"**Architecture Diagram (C4):**\n"
                f"```mermaid\n{response.mermaid_diagram}\n```"
            )
            if response.openapi_spec_delta and str(response.openapi_spec_delta).strip().lower() not in ("null", "none", ""):
                raw_content += f"\n\n**API Contract Delta:**\n```yaml\n{response.openapi_spec_delta}\n```"
        else:
            raw_content = response.get("output", str(response)) if isinstance(response, dict) else str(response)

        content = _wrap_thinking(reasoning, raw_content)

        state.messages.append({"role": "assistant", "content": content})
        log_event("architect", {"status": "success"})
        state.execution_trace.append(ExecutionTrace(node_name="architect", status="success"))
        state.next_node = "end"

    except Exception as e:
        log_event("architect", {"status": "failed", "error": str(e)})
        state.execution_trace.append(ExecutionTrace(node_name="architect", status="failed", error_log=str(e)))
        state.messages.append({"role": "assistant", "content": f"[Architect Error]: {str(e)}"})
        state.next_node = "end"

    return state
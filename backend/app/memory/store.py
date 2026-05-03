# app/memory/store.py
from app.schemas.state_schema import AgentState, EpisodicMemory


def record_failure(state: AgentState, node_name: str, failure_summary: str) -> AgentState:
    """
    Appends a failure event to episodic memory.
    This memory is injected into subsequent LLM prompts via build_reflexion_context,
    forcing the agent to alter its approach instead of repeating the same mistake.
    """
    state.episodic_memory.append(
        EpisodicMemory(
            attempt=state.reflexion_attempt,
            node_name=node_name,
            failure_summary=failure_summary
        )
    )
    return state


def build_reflexion_context(state: AgentState) -> str:
    """
    Serializes episodic memory into a prompt-injectable XML block.
    Returns empty string if no failures recorded yet.
    """
    if not state.episodic_memory:
        return ""
    memories = "\n".join(
        f"  [Attempt {m.attempt}] Node={m.node_name}: {m.failure_summary}"
        for m in state.episodic_memory
    )
    return (
        f"\n\n<reflexion_memory>\n"
        f"CRITICAL: Previous attempts failed. Do NOT repeat these mistakes:\n"
        f"{memories}\n"
        f"</reflexion_memory>"
    )
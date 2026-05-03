from app.adapters.llm import generate_fast, extract_text_content
from app.schemas.state_schema import AgentState, ExecutionTrace

VALID_NODES = {"coder", "architect", "debugger", "refactorer", "explainer", "researcher", "respond"}

ROUTING_PRIORITY = ["debugger", "refactorer", "architect", "coder", "researcher", "explainer", "respond"]

async def execute_router(state: AgentState) -> AgentState:
    user_message = extract_text_content(state.messages[-1]["content"]) if state.messages else ""

    routing_prompt = {
        "role": "user",
        "content": (
            "Analyze this request and classify it into EXACTLY ONE category.\n\n"
            "Categories:\n"
            "- coder       : writing new code, generating scripts, implementing a feature from scratch.\n"
            "- architect   : system design, software architecture, infrastructure, microservices, database schema.\n"
            "- debugger    : errors, bugs, stack traces, crashes, runtime/compile issues, performance regressions.\n"
            "- refactorer  : code modification, refactoring, optimization, restructuring, rewrite.\n"
            "- explainer   : how something works, explanations of concepts, algorithms, frameworks, trade-offs.\n"
            "- researcher  : deep research, advanced analysis, complex data synthesis, literature reviews.\n"
            "- respond     : general conversation, non-technical discussion, or no clear technical intent.\n\n"
            "Priority rule: if the request involves an active error or failure, prefer 'debugger' over all others.\n"
            "If the request involves changing existing code, prefer 'refactorer' over 'coder'.\n\n"
            f"User Request: \"{user_message}\"\n\n"
            "Reply with ONLY the category word. No explanation. No punctuation. No markdown."
        )
    }

    try:
        raw_text = await generate_fast([routing_prompt], api_key=state.api_key)
        candidate = raw_text.strip().lower().split()[0] if raw_text.strip() else "respond"

        resolved_node = candidate if candidate in VALID_NODES else _fallback_route(raw_text)

        state.next_node = resolved_node
        state.execution_trace.append(
            ExecutionTrace(node_name="router", status="success", error_log=f"Routed to: {state.next_node}")
        )

    except Exception as e:
        state.next_node = "respond"
        state.execution_trace.append(
            ExecutionTrace(node_name="router", status="failed", error_log=f"Routing Error: {str(e)}")
        )

    return state


def _fallback_route(raw_text: str) -> str:
    text = raw_text.lower()
    for node in ROUTING_PRIORITY:
        if node in text:
            return node
    return "respond"
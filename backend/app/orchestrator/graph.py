# app/orchestrator/graph.py
import time

from app.schemas.state_schema import AgentState, ExecutionTrace
from app.agents.router import execute_router
from app.agents.refactorer import execute_refactorer
from app.agents.debugger import execute_debugger
from app.agents.architect import execute_architect
from app.agents.coder import execute_coder
from app.agents.explainer import execute_explainer
from app.agents.researcher import execute_researcher
from app.tools.sandbox import execute_sandbox_evaluator
from app.tools.debugger_evaluator import execute_debugger_evaluator
from app.adapters.llm import stream_generate
from app.router.response_router import route
from app.core.config import FAST_MODEL
from app.core.logger import log_event

NODE_MAP = {
    "router":              execute_router,
    "refactorer":          execute_refactorer,
    "debugger":            execute_debugger,
    "sandbox_evaluator":   execute_sandbox_evaluator,
    "debugger_evaluator":  execute_debugger_evaluator,
    "architect":           execute_architect,
    "coder":               execute_coder,
    "explainer":           execute_explainer,
    "researcher":          execute_researcher,
}

MAX_GRAPH_ITERATIONS = 12
MAX_NODE_REVISITS    = 3


async def run_agent_graph(req_dict: dict):
    state = AgentState(**req_dict)
    state.next_node = "router"

    iteration_count   = 0
    node_visit_counts: dict[str, int] = {}

    while (
        state.next_node not in ("end", "respond", "coder")
        and iteration_count < MAX_GRAPH_ITERATIONS
    ):
        current_node = state.next_node

        node_visit_counts[current_node] = node_visit_counts.get(current_node, 0) + 1
        if node_visit_counts[current_node] > MAX_NODE_REVISITS:
            log_event("graph_engine", {
                "status": "velocity_cap_triggered",
                "node":   current_node,
                "visits": node_visit_counts[current_node],
            })
            state.execution_trace.append(ExecutionTrace(
                node_name="graph_engine",
                status="velocity_cap",
                error_log=f"Node '{current_node}' loop detected.",
            ))
            state.messages.append({
                "role": "assistant",
                "content": f"[System] Velocity cap: node '{current_node}' looped. Halted.",
            })
            state.next_node = "end"
            break

        if current_node in NODE_MAP:
            yield {"type": "node_update", "node": current_node}

            state.active_node = current_node
            state.visited_nodes.append(current_node)
            state.next_node = "end"

            t0    = time.monotonic()
            state = await NODE_MAP[current_node](state)
            latency = round((time.monotonic() - t0) * 1000, 2)

            log_event("graph_engine", {
                "iteration":  iteration_count,
                "node":       current_node,
                "next":       state.next_node,
                "latency_ms": latency,
            })
        else:
            state.execution_trace.append(ExecutionTrace(
                node_name="graph_engine",
                status="failed",
                error_log=f"Node '{current_node}' not in NODE_MAP.",
            ))
            state.next_node = "respond"

        iteration_count += 1

    if iteration_count >= MAX_GRAPH_ITERATIONS:
        state.messages.append({
            "role": "assistant",
            "content": "[System] Agent Graph halted: max iterations reached.",
        })

    if state.messages and state.messages[-1]["role"] == "assistant":
        render_mode = route(state.messages[-1]["content"])
        log_event("response_router", {"mode": render_mode})

    if state.next_node in ("respond", "coder"):
        if state.next_node == "coder":
            SYSTEM_PROMPT = {
                "role": "system",
                "content": (
                    "You are an expert principal software engineer and clean coder. "
                    "You generate production-ready, highly optimized, and maintainable code. "
                    "CRITICAL: If the user explicitly asks for ONLY code, output strictly raw code "
                    "without markdown block formatting, backticks, or explanations. "
                    "Otherwise, use standard markdown."
                )
            }
            # Coder always uses MODEL (main model)
            stream_model = None

        else:  # respond
            SYSTEM_PROMPT = {
                "role": "system",
                "content": (
                    "You are a senior software engineering assistant and code tutor. "
                    "You are precise, technical, and concise. "
                    "Respond in the same language the user uses. "
                    "Do NOT use emojis. Keep tone professional. "
                    "Use markdown formatting instead of emojis for emphasis."
                )
            }
            # FIX: use MODEL (reasoning) if thinking_mode, else FAST_MODEL
            # None → stream_generate defaults to MODEL
            stream_model = None if state.thinking_mode else FAST_MODEL

        async for token in stream_generate(
            [SYSTEM_PROMPT] + state.messages,
            api_key=state.api_key,
            model=stream_model
        ):
            yield token

    else:
        if state.messages and state.messages[-1]["role"] == "assistant":
            content = state.messages[-1]["content"]
            for char in content:
                yield char
        else:
            yield "[System] Execution completed with no assistant output."
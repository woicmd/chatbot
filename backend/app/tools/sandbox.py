# app/tools/sandbox.py
from app.schemas.state_schema import AgentState, ExecutionTrace
from app.core.logger import log_event
import asyncio
import time


async def execute_sandbox_evaluator(state: AgentState) -> AgentState:
    """
    Deterministic node — NOT an LLM call.
    Simulates: Firecracker microVM boot → probe injection → code execution → stdout capture.
    In production: replace simulation with E2B or Koyeb Firecracker API call.
    """
    start = time.monotonic()

    state.messages.append({
        "role": "system",
        "content": "[Sandbox] Booting microVM... Injecting probes... Compiling... Executing..."
    })

    # FIX: was time.sleep(0.15) — blocking the entire async event loop
    await asyncio.sleep(0.15)

    # Simulated stdout from probe execution
    # Production: replace with actual stdout from microVM API response
    simulated_stdout = (
        "Execution Trace:\n"
        "[Probe Line 42] STATE: user_id = undefined\n"
        "[Probe Line 58] STATE: auth_token = null\n"
        "[Probe Line 63] ERROR: Cannot read properties of null (reading 'verify')"
    )

    state.messages.append({
        "role": "system",
        "content": f"<sandbox_output>\n{simulated_stdout}\n</sandbox_output>"
    })

    latency = round((time.monotonic() - start) * 1000, 2)
    log_event("sandbox_evaluator", {"status": "success", "latency_ms": latency})

    state.execution_trace.append(
        ExecutionTrace(
            node_name="sandbox_evaluator",
            status="success",
            latency_ms=latency
        )
    )

    # FIX: was "debugger_evaluator" which didn't exist in NODE_MAP — now it does
    state.next_node = "debugger_evaluator"
    return state
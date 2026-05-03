# app/orchestrator/agent.py
from app.adapters.llm import generate_plan, stream_generate
from app.tools.registry import execute, TOOLS
from app.core.config import MAX_ITER
import json

available_tools = list(TOOLS.keys())

SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "You are an agent. Always output strict JSON with keys: "
        "action (tool|respond), name, args, output. No extra text.\n"
        f"Available tools: {json.dumps(available_tools)}"
    )
}

async def run_agent(req):
    messages = [SYSTEM_PROMPT] + req.get("messages", [])

    for _ in range(MAX_ITER):
        plan = await generate_plan(messages)

        if plan.get("action") == "tool":
            result = await execute(plan["name"], plan.get("args", {}))

            messages.append({
                "role": "assistant",
                "content": f"Tool result: {result}"
            })
            continue

        final_messages = messages + [{
            "role": "assistant",
            "content": plan.get("output", "")
        }]

        async for token in stream_generate(final_messages):
            yield token

        return

    yield "Max iteration reached"
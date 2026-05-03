# app/api/chat.py
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from app.orchestrator.graph import run_agent_graph
from app.core.config import INJECTION_RE, MAX_HISTORY
import json

router = APIRouter()


class ChatRequest(BaseModel):
    messages: List[Dict[str, Any]]
    api_key: Optional[str] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None


def _sanitize_history(messages: list) -> list:
    """Apply sliding window and injection filter to incoming messages."""
    recent = messages[-MAX_HISTORY:]
    safe = []
    for m in recent:
        if m.get("role") == "system":
            continue
        content = m.get("content", "")
        if isinstance(content, str) and INJECTION_RE.search(content):
            safe.append({"role": m["role"], "content": "[message filtered]"})
            continue
        safe.append(m)
    return safe


@router.post("/chat")
async def chat(req: ChatRequest):
    # DEBUG: trace what content types arrive from frontend
    for idx, m in enumerate(req.messages):
        c = m.get("content", "")
        if isinstance(c, list):
            types = [p.get("type") for p in c]
            print(f"[DEBUG chat] msg[{idx}] role={m['role']} content=LIST types={types}", flush=True)
        else:
            print(f"[DEBUG chat] msg[{idx}] role={m['role']} content=STR len={len(str(c))}", flush=True)

    sanitized = _sanitize_history(req.messages)

    state_dict = {
        "messages": sanitized,
        "api_key": req.api_key,
    }

    async def event_stream():
        try:
            async for token in run_agent_graph(state_dict):
                if token is None:
                    continue
                yield f"data: {json.dumps(token)}\n\n"
            yield 'data: "[DONE]"\n\n'
        except Exception as e:
            yield f"data: {json.dumps(f'ERROR: {str(e)}')}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
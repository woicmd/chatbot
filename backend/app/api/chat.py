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
    thinking_mode: Optional[bool] = False  # ← NEW


def _sanitize_history(messages: list) -> list:
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
    sanitized = _sanitize_history(req.messages)

    state_dict = {
        "messages": sanitized,
        "api_key": req.api_key,
        "thinking_mode": req.thinking_mode or False,  # ← NEW
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
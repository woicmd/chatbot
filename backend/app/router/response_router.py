# app/router/response_router.py
from typing import Literal

RenderMode = Literal["code-inline", "artifact", "text", "diagram"]


def route(output: str) -> RenderMode:
    """
    Classifies agent output for downstream UI rendering.
    In production, the frontend reads this from a response header or wrapper field.
    For PowerShell/SSE testing, this is logged via log_event only.
    """
    lines = output.count("\n")

    if "```mermaid" in output:
        return "diagram"

    if "```" in output:
        if lines < 20:
            return "code-inline"
        return "artifact"

    return "text"
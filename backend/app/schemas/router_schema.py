from pydantic import BaseModel, Field
from typing import Literal


class RouterDecision(BaseModel):
    next_node: Literal["coder", "refactorer", "architect", "debugger", "explainer", "researcher", "respond"] = Field(
        ..., description="The exact name of the specialist node to handle the request."
    )
    reasoning: str = Field(..., description="A short explanation of why this node was chosen.")
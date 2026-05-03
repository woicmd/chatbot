# app/schemas/state.py
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from app.schemas.diff_schema import DiffBlock


class ExecutionTrace(BaseModel):
    node_name: str
    status: str
    latency_ms: Optional[float] = None
    error_log: Optional[str] = None


class EpisodicMemory(BaseModel):
    """Stores failure summaries for Reflexion pipeline."""
    attempt: int
    node_name: str
    failure_summary: str


class AgentState(BaseModel):
    messages: List[Dict[str, Any]]
    active_node: str = "router"
    next_node: str = "router"                          # FIX: was "end" → graph never ran
    execution_trace: List[ExecutionTrace] = Field(default_factory=list)
    ast_context: Optional[Dict[str, Any]] = None
    diff_payload: Optional[List[DiffBlock]] = None
    episodic_memory: List[EpisodicMemory] = Field(default_factory=list)
    reflexion_attempt: int = 0
    visited_nodes: List[str] = Field(default_factory=list)
    api_key: Optional[str] = None
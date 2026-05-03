from pydantic import BaseModel, Field
from typing import List, Literal, Optional


class TradeoffMatrix(BaseModel):
    scalability: str = Field(..., description="Quantitative impact on peak throughput.")
    latency: str = Field(..., description="Estimated tail latency delta (e.g., +150ms due to serialization).")
    consistency: str = Field(..., description="CAP theorem evaluation (e.g., Eventual vs. Strong).")
    maintenance_overhead: str = Field(..., description="Operational cost and CI/CD complexity.")
    infrastructure_cost: str = Field(..., description="Compute and storage cost estimations.")


class FMEAEntry(BaseModel):
    failure_mode: str = Field(..., description="Description of the failure mode or SPOF.")
    impact: int = Field(..., ge=1, le=10, description="Severity of impact if the failure occurs (1–10).")
    occurrence: int = Field(..., ge=1, le=10, description="Likelihood of the failure occurring (1–10).")
    detection: int = Field(..., ge=1, le=10, description="Difficulty of detecting the failure before impact (1–10).")
    rpn: int = Field(..., description="Risk Priority Number = Impact × Occurrence × Detection.")
    mitigation: str = Field(..., description="Recommended mitigation. Must reference Circuit Breaker or failover patterns where applicable.")


class ADREntry(BaseModel):
    title: str = Field(..., description="Short title of the architectural decision.")
    status: Literal["proposed", "accepted", "deprecated", "superseded"] = Field(
        ..., description="Current lifecycle status of this ADR."
    )
    context: str = Field(..., description="The situation and constraints that forced this decision.")
    decision: str = Field(..., description="The exact architectural choice made.")
    consequences: str = Field(..., description="Trade-offs and downstream effects of this decision.")


class SystemDesignProposal(BaseModel):
    status: Literal["success", "failure"]
    architecture_summary: str = Field(..., description="High-level structural summary. Zero filler.")
    tradeoff_evaluation: TradeoffMatrix
    fmea_table: List[FMEAEntry] = Field(
        default_factory=list,
        description="FMEA risk table for all identified SPOFs. Sorted by RPN descending."
    )
    adrs: List[ADREntry] = Field(
        default_factory=list,
        description="Architectural Decision Records for each significant design choice."
    )
    mermaid_diagram: str = Field(..., description="Strict Mermaid.js syntax only. Must reflect C4 model level appropriate to the design scope.")
    openapi_spec_delta: Optional[str] = Field(None, description="Changes to API contracts, if applicable.")
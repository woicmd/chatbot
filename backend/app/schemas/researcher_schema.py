from pydantic import BaseModel, Field
from typing import List, Literal, Optional


class FMEARisk(BaseModel):
    risk: str = Field(..., description="Description of the risk, gap, or threat identified in the research.")
    probability: int = Field(..., ge=1, le=10, description="Likelihood of this risk materializing (1–10).")
    impact: int = Field(..., ge=1, le=10, description="Severity of impact if the risk materializes (1–10).")
    rpn: int = Field(..., description="Risk Priority Number = Probability × Impact.")
    mitigation: str = Field(..., description="Recommended mitigation or area for further investigation.")


class DeepResearchProposal(BaseModel):
    status: Literal["success", "failure"]
    reasoning: str = Field(
        ...,
        description=(
            "Internal cognitive process covering: Deconstruction, Hypothesis Generation, "
            "Evidence Gathering, Adversarial Critique with confidence levels, and FMEA Risk Framing."
        )
    )
    research_report: str = Field(
        ...,
        description=(
            "Final synthesized markdown report. Structured with clear section headers. "
            "Every uncertain claim must carry an inline confidence level: High (>80%), Medium (40–80%), Low (<40%)."
        )
    )
    fmea_risk_table: Optional[List[FMEARisk]] = Field(
        None,
        description="Risk table for research topics involving systems, decisions, or strategies. Sorted by RPN descending."
    )
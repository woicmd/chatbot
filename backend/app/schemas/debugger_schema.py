from pydantic import BaseModel, Field
from typing import List, Literal, Optional
from app.schemas.diff_schema import DiffBlock


class DebugProbe(BaseModel):
    file_path: str
    line_number_approx: int
    probe_code: str = Field(..., description="Log statement to inject at the suspected failure boundary.")


class TieredRemediation(BaseModel):
    minimal_fix: str = Field(
        ...,
        description="Immediate configuration or parameter change. Low risk. Deployable in minutes."
    )
    robust_fix: str = Field(
        ...,
        description="Structural code or infrastructure change that addresses the root cause permanently."
    )
    preventive: str = Field(
        ...,
        description="SLO-as-Code gate, Chaos Engineering drill, or dual-window burn rate alert to prevent recurrence."
    )


class DebuggingHypothesis(BaseModel):
    confidence_level: Literal["High", "Medium", "Low"] = Field(
        ...,
        description="Confidence in the root cause hypothesis. High >80%, Medium 40–80%, Low <40%."
    )
    root_cause_hypothesis: str = Field(
        ...,
        description="One falsifiable hypothesis for the root cause, derived from USE Method and 5 Whys drill."
    )
    ishikawa_category: Literal["Methods", "Machines", "Measurement", "People"] = Field(
        ...,
        description="Fishbone category the root cause falls under."
    )
    expected_state: str = Field(..., description="What the system state should be at the failure point.")
    actual_state_observation: Optional[str] = Field(None, description="Filled after sandbox probe execution.")
    tiered_remediation: TieredRemediation = Field(
        ...,
        description="Three-tier remediation plan: Minimal Fix, Robust Fix, and Preventive measure."
    )
    probes_to_inject: List[DebugProbe] = Field(
        ...,
        description="Precise log probes to inject at suspected failure boundaries for sandbox validation."
    )
    proposed_fix: Optional[List[DiffBlock]] = Field(
        None,
        description="Only populated once sandbox observation confirms the hypothesis."
    )
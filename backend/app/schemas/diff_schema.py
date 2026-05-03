from pydantic import BaseModel, Field
from typing import List, Literal, Optional


class DiffBlock(BaseModel):
    file_path: str
    diff_format: Literal["xml"] = "xml"
    content: str = Field(
        ...,
        description="Must contain exact <search>...</search> and <replace>...</replace> tags."
    )


class SmellFinding(BaseModel):
    smell_type: Literal[
        "CyclicDependency",
        "GodComponent",
        "AmbiguousInterface",
        "DuplicateCode",
        "PrimitiveObsession",
        "LongMethod",
        "FeatureEnvy"
    ] = Field(..., description="Classified smell type from the audit taxonomy.")
    location: str = Field(..., description="Exact file path and function/class name where the smell was detected.")
    pattern_applied: str = Field(
        ...,
        description="Refactoring pattern selected to resolve this smell (e.g., Extract Class, Strategy Pattern, Value Object)."
    )


class ArchitecturalImpact(BaseModel):
    cyclomatic_complexity_delta: str = Field(
        ...,
        description="Expected change in McCabe cyclomatic complexity (e.g., '-12 across 3 functions')."
    )
    afferent_coupling_delta: str = Field(
        ...,
        description="Expected change in afferent coupling (Ca) — number of classes that depend on this module."
    )
    testability_improvement: str = Field(
        ...,
        description="Qualitative assessment of testability improvement (e.g., 'Isolated IngestionGateway enables unit testing without DB stub')."
    )


class RefactorResponse(BaseModel):
    status: Literal["success", "failure", "partial"]
    reasoning_trace: str = Field(..., description="Four-phase protocol trace: Smell Detection, Pattern Selection, Diff Generation, Impact Estimate.")
    smell_audit: List[SmellFinding] = Field(
        default_factory=list,
        description="All architectural and implementation smells detected before diff generation."
    )
    architectural_impact: ArchitecturalImpact = Field(
        ...,
        description="Quantified and qualitative impact estimates post-refactoring."
    )
    diff_payload: List[DiffBlock]
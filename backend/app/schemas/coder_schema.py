from pydantic import BaseModel, Field
from typing import List, Literal, Optional


class TestCase(BaseModel):
    scenario: str = Field(..., description="Given-When-Then BDD scenario or unit test description.")
    test_type: Literal["unit", "integration", "bdd"] = Field(..., description="Classification of the test.")
    stub: str = Field(..., description="Minimal test stub code that would initially fail (RED phase).")


class SecurityNote(BaseModel):
    category: Literal["sast", "dependency", "secret_hygiene"] = Field(
        ..., description="DevSecOps category: OWASP/SAST flag, third-party SBOM risk, or secret hygiene check."
    )
    severity: Literal["critical", "high", "medium", "low", "pass"] = Field(
        ..., description="Risk severity. 'pass' means no issue found."
    )
    detail: str = Field(..., description="Specific description of the risk or confirmation of clean pass.")


class CodeGenerationResponse(BaseModel):
    status: Literal["success", "failure", "partial"]
    requirement_summary: str = Field(
        ...,
        description="Decomposed FR/NFR/Assumptions derived from the request before implementation began."
    )
    generated_code: str = Field(
        ...,
        description=(
            "Production-grade implementation conforming to NASA coding rules: "
            "fixed-bound loops, minimal heap allocation in hot paths, "
            "functions ≤ 60 lines, SRP, and explicit error handling."
        )
    )
    test_suite: List[TestCase] = Field(
        default_factory=list,
        description="TDD/BDD test cases. Must be defined before implementation (RED phase contract)."
    )
    security_notes: List[SecurityNote] = Field(
        default_factory=list,
        description="DevSecOps compliance checklist: SAST surface, dependency risk, secret hygiene."
    )
    commit_message: str = Field(
        ...,
        description=(
            "Conventional Commits message. Format: <type>(<scope>): <description>. "
            "Types: feat|fix|refactor|perf|test|docs|chore|ci. "
            "Imperative, lowercase, max 72 chars. "
            "Append 'BREAKING CHANGE:' footer if applicable."
        )
    )
    nasa_violations: List[str] = Field(
        default_factory=list,
        description=(
            "List any NASA coding rule violations detected in the generated code, if any. "
            "Empty list means full compliance."
        )
    )
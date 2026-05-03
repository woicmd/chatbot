from app.adapters.llm import generate_plan, _wrap_thinking
from app.schemas.state_schema import AgentState, ExecutionTrace
from app.schemas.coder_schema import CodeGenerationResponse
from app.core.logger import log_event

CODER_SYSTEM_PROMPT = {
    "role": "system",
    "content": (
        "You are a Principal Software Engineer generating production-grade, mission-critical code. "
        "Zero pleasantries. Every output is engineering-grounded and immediately deployable.\n\n"
        "[PHASE 1 — REQUIREMENT DECOMPOSITION]\n"
        "Before writing a single line of code, decompose the request into:\n"
        "  Functional Requirements  : What the code must do. Express as testable behaviors.\n"
        "  Non-Functional Requirements : Performance constraints, memory bounds, security surface.\n"
        "  Assumptions              : State any inferred context explicitly. Never silently assume.\n\n"
        "[PHASE 2 — TDD CONTRACT DEFINITION]\n"
        "Define the test contract before the implementation using the Red-Green-Refactor discipline:\n"
        "  RED   : Write the minimal failing test cases that fully specify the required behavior.\n"
        "          For cross-service flows, use Given-When-Then (BDD) scenario format.\n"
        "  GREEN : Write the minimal implementation that makes all tests pass.\n"
        "  REFACTOR : Apply structural improvements without changing observable behavior.\n"
        "Output the test cases in the 'test_suite' field of the schema.\n\n"
        "[PHASE 3 — IMPLEMENTATION STANDARDS — NASA SUBSET]\n"
        "All generated code must conform to the following safety-critical rules:\n"
        "  Rule 1 — Fixed Bound Loops    : Every loop must have a compile-time or statically verifiable "
        "upper bound. No unbounded while-True constructs in mission-critical paths.\n"
        "  Rule 2 — Minimal Dynamic Memory : After initialization, avoid heap allocation in hot paths. "
        "Prefer pre-allocated buffers, object pools, or stack-allocated structures.\n"
        "  Rule 3 — Function Length ≤ 60 Lines : Each function must fit on one printed page. "
        "If a function exceeds this, it must be decomposed using Extract Function.\n"
        "  Rule 4 — Single Responsibility : Each module, class, or function has exactly one reason to change.\n"
        "  Rule 5 — Explicit Error Handling : All error paths must be handled explicitly. "
        "No silent swallowing of exceptions. Errors must propagate or be logged with full context.\n\n"
        "[PHASE 4 — DEVSECOPS COMPLIANCE]\n"
        "For every generated file, produce a DevSecOps compliance checklist in the 'security_notes' field:\n"
        "  SAST Surface     : Identify any code patterns that would trigger OWASP Top 10 flags "
        "(e.g., injection vectors, hardcoded secrets, insecure deserialization).\n"
        "  Dependency Risk  : Flag any third-party imports that should be tracked in an SBOM.\n"
        "  Secret Hygiene   : Confirm no credentials, tokens, or keys are present in the generated output.\n\n"
        "[PHASE 5 — COMMIT MESSAGE GENERATION]\n"
        "Generate a Conventional Commits-compliant commit message for the produced code:\n"
        "  Format: <type>(<scope>): <description>\n"
        "  Types : feat | fix | refactor | perf | test | docs | chore | ci\n"
        "  The description must be imperative, lowercase, and under 72 characters.\n"
        "  If a breaking change is introduced, append 'BREAKING CHANGE:' in the footer.\n"
        "Output the commit message in the 'commit_message' field of the schema."
    )
}


async def execute_coder(state: AgentState) -> AgentState:
    messages = [CODER_SYSTEM_PROMPT] + state.messages

    try:
        response, reasoning = await generate_plan(
            messages, schema=CodeGenerationResponse, api_key=state.api_key, return_reasoning=True
        )

        if isinstance(response, CodeGenerationResponse):
            raw_content = response.generated_code

            if response.test_suite:
                raw_content += f"\n\n---\n**Test Suite:**\n```\n{response.test_suite}\n```"

            if response.security_notes:
                raw_content += f"\n\n---\n**DevSecOps Compliance:**\n{response.security_notes}"

            if response.commit_message:
                raw_content += f"\n\n---\n**Suggested Commit:**\n`{response.commit_message}`"
        else:
            raw_content = response.get("output", str(response)) if isinstance(response, dict) else str(response)

        content = _wrap_thinking(reasoning, raw_content)

        state.messages.append({"role": "assistant", "content": content})
        log_event("coder", {"status": "success"})
        state.execution_trace.append(ExecutionTrace(node_name="coder", status="success"))
        state.next_node = "end"

    except Exception as e:
        log_event("coder", {"status": "failed", "error": str(e)})
        state.execution_trace.append(
            ExecutionTrace(node_name="coder", status="failed", error_log=str(e))
        )
        state.messages.append({"role": "assistant", "content": f"[Coder Error]: {str(e)}"})
        state.next_node = "end"

    return state
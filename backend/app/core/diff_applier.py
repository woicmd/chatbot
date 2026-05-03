# app/core/diff_applier.py
import re


def apply_xml_diff(original_code: str, search_block: str, replace_block: str) -> str:
    """
    Applies order-invariant search-and-replace based on XML diff agent output.
    Searches for the exact semantic block and swaps it, eliminating
    line-number dependency and hunk header misalignment failures.
    """
    search_clean = search_block.strip()
    replace_clean = replace_block.strip()

    if search_clean not in original_code:
        raise ValueError(
            f"Target search block not found in source code. "
            f"Context drift detected. Preview: '{search_clean[:80]}...'"
        )

    updated_code = original_code.replace(search_clean, replace_clean)
    return updated_code


def parse_xml_diff_blocks(diff_content: str) -> list[dict]:
    """
    Extracts all <search>/<replace> pairs from a single DiffBlock content string.
    Returns list of {"search": str, "replace": str} dicts.
    """
    pattern = r"<search>(.*?)</search>\s*<replace>(.*?)</replace>"
    matches = re.findall(pattern, diff_content, re.DOTALL)
    return [{"search": s.strip(), "replace": r.strip()} for s, r in matches]
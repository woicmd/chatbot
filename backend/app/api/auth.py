# app/api/auth.py
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import httpx

router = APIRouter()

OPENROUTER_BASE = "https://openrouter.ai/api/v1"

class ValidateKeyRequest(BaseModel):
    api_key: str

class ValidateKeyResponse(BaseModel):
    valid: bool
    detail: Optional[str] = None

@router.post("/validate-key", response_model=ValidateKeyResponse)
async def validate_key(req: ValidateKeyRequest):
    """Validate an OpenRouter API key by calling the models endpoint."""
    if not req.api_key or len(req.api_key) < 8:
        return ValidateKeyResponse(valid=False, detail="Key too short")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.get(
                f"{OPENROUTER_BASE}/models",
                headers={"Authorization": f"Bearer {req.api_key}"},
            )
            if res.status_code == 200:
                return ValidateKeyResponse(valid=True)
            else:
                return ValidateKeyResponse(
                    valid=False,
                    detail=f"API returned status {res.status_code}",
                )
    except Exception as e:
        return ValidateKeyResponse(valid=False, detail=str(e))

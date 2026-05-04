# app/adapters/llm.py
import json
import re
from typing import Optional, Type, TypeVar, Any
from pydantic import BaseModel
from openai import AsyncOpenAI
from app.core.config import OPENROUTER_API_KEY, MODEL, FAST_MODEL, MAX_TOKENS, TEMPERATURE, TOP_P, VISION_MODEL

OPENROUTER_URL = "https://openrouter.ai/api/v1"
T = TypeVar("T", bound=BaseModel)

def _resolve_key(api_key: Optional[str] = None) -> str:
    provided = api_key.strip() if api_key and isinstance(api_key, str) else ""
    if provided.lower() in ("undefined", "null", "none"):
        provided = ""
    key = provided or OPENROUTER_API_KEY
    if not key:
        raise RuntimeError("No API key available.")
    return key.strip()

def get_client(api_key: Optional[str] = None) -> AsyncOpenAI:
    key = _resolve_key(api_key)
    return AsyncOpenAI(
        base_url=OPENROUTER_URL,
        api_key=key,
        default_headers={
            "Authorization": f"Bearer {key}",
            "HTTP-Referer": "http://localhost",
            "X-Title": "Chatbot",
        }
    )

def extract_text_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n\n".join(p.get("text", "") for p in content if p.get("type") == "text")
    return str(content)

def _sanitize_messages(messages: list) -> list:
    sanitized = []
    for i, msg in enumerate(messages):
        content = msg.get("content", "")
        if msg["role"] == "system" and i > 0:
            str_content = extract_text_content(content)
            sanitized.append({"role": "user", "content": f"[SYSTEM]: {str_content}"})
        elif msg["role"] == "assistant":
            entry = {"role": "assistant", "content": content}
            if msg.get("reasoning_details"):
                entry["reasoning_details"] = msg["reasoning_details"]
            sanitized.append(entry)
        else:
            sanitized.append({"role": msg["role"], "content": content})
    return sanitized

def _has_image_in_last_user_msg(messages: list) -> bool:
    """
    FIX: Only check the LAST user message for images.
    Previously checked ALL messages → kept using VISION_MODEL after image was gone.
    """
    for msg in reversed(messages):
        if msg.get("role") == "user":
            content = msg.get("content", "")
            if isinstance(content, list):
                return any(p.get("type") == "image_url" for p in content)
            return False  # last user msg has no image
    return False

def _extract_reasoning(message) -> str:
    if hasattr(message, 'reasoning_content') and message.reasoning_content:
        return message.reasoning_content
    if hasattr(message, 'model_extra') and message.model_extra:
        extra = message.model_extra
        return (
            extra.get('reasoning') or
            extra.get('reasoning_content') or
            extra.get('thinking') or ""
        )
    return ""

def _wrap_thinking(reasoning: str, content: str) -> str:
    if reasoning and reasoning.strip():
        return f"<think>\n{reasoning.strip()}\n</think>\n\n{content}"
    return content

def _strip_think_from_content(text: str) -> str:
    """Strip any <think> tags model embedded directly in delta.content."""
    # Remove complete think blocks
    text = re.sub(r'<think>[\s\S]*?</think>', '', text, flags=re.IGNORECASE)
    # Remove stray open/close tags
    text = re.sub(r'</?think>', '', text, flags=re.IGNORECASE)
    return text

async def generate_fast(messages: list, api_key: Optional[str] = None) -> str:
    messages = _sanitize_messages(messages)
    client = get_client(api_key)
    print(f"[LLM] generate_fast model: {FAST_MODEL}", flush=True)
    response = await client.chat.completions.create(
        model=FAST_MODEL,
        messages=messages,
        temperature=0.0,
        max_tokens=50,
    )
    return (response.choices[0].message.content or "").strip()

async def generate_plan(
    messages: list,
    schema: Optional[Type[T]] = None,
    api_key: Optional[str] = None,
    return_reasoning: bool = False
) -> Any:
    messages = _sanitize_messages(messages)
    client = get_client(api_key)

    has_image = _has_image_in_last_user_msg(messages)
    selected_model = VISION_MODEL if has_image else MODEL
    print(f"[LLM] generate_plan model: {selected_model} (has_image: {has_image})", flush=True)

    payload = {
        "model": selected_model,
        "messages": messages,
        "temperature": 0.01,
        "max_tokens": MAX_TOKENS,
        "extra_body": {"reasoning": {"enabled": True}}
    }

    if schema:
        schema_json = json.dumps(schema.model_json_schema(), indent=2)
        instruction = (
            f"\n\nCRITICAL: Return ONLY a valid JSON object matching this schema. "
            f"No markdown blocks. Raw JSON only.\n\nSchema:\n{schema_json}"
        )
        if messages and messages[-1]["role"] in ("user", "system"):
            last_content = messages[-1]["content"]
            if isinstance(last_content, list):
                last_content.append({"type": "text", "text": instruction})
            else:
                messages[-1]["content"] = last_content + instruction
        else:
            messages.append({"role": "user", "content": instruction})
        payload["response_format"] = {"type": "json_object"}

    try:
        response = await client.chat.completions.create(**payload)
    except Exception as e:
        if schema and "response_format" in payload:
            del payload["response_format"]
            response = await client.chat.completions.create(**payload)
        else:
            raise e

    msg = response.choices[0].message
    text = (msg.content or "").strip()
    reasoning = _extract_reasoning(msg)

    if schema:
        text = re.sub(r'<think>[\s\S]*?</think>', '', text, flags=re.IGNORECASE).strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        result = schema.model_validate_json(text)
        return (result, reasoning) if return_reasoning else result

    try:
        result = json.loads(text)
    except Exception:
        result = {"action": "respond", "output": text}

    return (result, reasoning) if return_reasoning else result


async def stream_generate(
    messages: list,
    api_key: Optional[str] = None,
    model: Optional[str] = None
):
    messages = _sanitize_messages(messages)
    client = get_client(api_key)

    # FIX: only check last user message for image
    has_image = _has_image_in_last_user_msg(messages)
    selected_model = model or (VISION_MODEL if has_image else MODEL)
    print(f"[LLM] stream_generate model: {selected_model} (has_image: {has_image})", flush=True)

    response = await client.chat.completions.create(
        model=selected_model,
        messages=messages,
        max_tokens=MAX_TOKENS,
        temperature=TEMPERATURE,
        top_p=TOP_P,
        stream=True,
        extra_body={"reasoning": {"enabled": True}}
    )

    in_reasoning = False
    accumulated_reasoning = ""

    async for chunk in response:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta

        r_tok = None
        if hasattr(delta, 'reasoning_content') and delta.reasoning_content:
            r_tok = delta.reasoning_content
        elif hasattr(delta, 'model_extra') and delta.model_extra:
            extra = delta.model_extra
            r_tok = (
                extra.get('reasoning') or
                extra.get('reasoning_content') or
                extra.get('thinking')
            )

        if r_tok:
            if not in_reasoning:
                yield "<think>\n"
                in_reasoning = True
            accumulated_reasoning += r_tok
            yield r_tok

        if hasattr(delta, 'content') and delta.content:
            if in_reasoning:
                yield "\n</think>\n\n"
                in_reasoning = False
            # FIX: strip any <think> tags model embedded in content directly
            # prevents double thinking blocks on frontend
            clean = _strip_think_from_content(delta.content)
            if clean:
                yield clean

    if in_reasoning:
        yield "\n</think>\n\n"

    if accumulated_reasoning:
        yield {
            "type": "reasoning_details",
            "data": [{"type": "thinking", "thinking": accumulated_reasoning}]
        }
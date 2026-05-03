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
        raise RuntimeError("No API key available. Provide one via login or set OPENROUTER_API_KEY env var.")
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
        text_parts = []
        for part in content:
            if part.get("type") == "text":
                text_parts.append(part.get("text", ""))
        return "\n\n".join(text_parts)
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

def _extract_reasoning(message) -> str:
    """Extract reasoning/thinking text from a non-streaming response message."""
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
    """Prepend <think> block to content if reasoning exists."""
    if reasoning and reasoning.strip():
        return f"<think>\n{reasoning.strip()}\n</think>\n\n{content}"
    return content

async def generate_fast(messages: list, api_key: Optional[str] = None) -> str:
    """Untuk routing/klasifikasi — pakai FAST_MODEL, max 50 token, deterministik."""
    messages = _sanitize_messages(messages)
    client = get_client(api_key)

    print(f"[LLM] generate_fast using model: {FAST_MODEL}", flush=True)

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
    """Untuk semua agent skill — pakai MODEL atau VISION_MODEL jika ada gambar."""
    messages = _sanitize_messages(messages)
    client = get_client(api_key)

    has_image = any(
        isinstance(msg.get("content"), list) and
        any(p.get("type") == "image_url" for p in msg["content"])
        for msg in messages
    )
    selected_model = VISION_MODEL if has_image else MODEL

    print(f"[LLM] generate_plan using model: {selected_model} (has_image: {has_image})", flush=True)

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
            f"\n\nCRITICAL: You MUST return ONLY a valid JSON object matching this schema. "
            f"Do NOT wrap in ```json markdown blocks. Just raw JSON.\n\nSchema:\n{schema_json}"
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
        if return_reasoning:
            return result, reasoning
        return result

    try:
        result = json.loads(text)
    except Exception:
        result = {"action": "respond", "output": text}

    if return_reasoning:
        return result, reasoning
    return result


async def stream_generate(
    messages: list,
    api_key: Optional[str] = None,
    model: Optional[str] = None
):
    """
    Untuk streaming output ke client.
    model override: eksplisit > VISION_MODEL (jika ada gambar) > MODEL default.
    """
    messages = _sanitize_messages(messages)
    client = get_client(api_key)

    has_image = any(
        isinstance(msg.get("content"), list) and
        any(p.get("type") == "image_url" for p in msg["content"])
        for msg in messages
    )

    for idx, msg in enumerate(messages):
        c = msg.get("content", "")
        if isinstance(c, list):
            types = [p.get("type") for p in c]
            print(f"[DEBUG stream_generate] msg[{idx}] role={msg['role']} content=LIST types={types}", flush=True)
        else:
            print(f"[DEBUG stream_generate] msg[{idx}] role={msg['role']} content=STR len={len(c)}", flush=True)

    selected_model = model or (VISION_MODEL if has_image else MODEL)
    print(f"[LLM] stream_generate using model: {selected_model} (has_image: {has_image})", flush=True)

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
            yield delta.content

    if in_reasoning:
        yield "\n</think>\n\n"

    if accumulated_reasoning:
        yield {
            "type": "reasoning_details",
            "data": [{"type": "thinking", "thinking": accumulated_reasoning}]
        }
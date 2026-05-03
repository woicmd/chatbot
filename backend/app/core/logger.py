# app/core/logger.py
import time
import json
import sys


def log_event(name: str, data: dict):
    """
    Structured logger. Writes to stderr so it does not pollute SSE stdout stream.
    In production, replace with OpenTelemetry/LangSmith span emission.
    """
    entry = {
        "event": name,
        "data": data,
        "ts": round(time.time(), 4)
    }
    print(json.dumps(entry), file=sys.stderr, flush=True)
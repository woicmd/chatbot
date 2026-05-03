import os
import re
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()

MODEL = os.getenv("MODEL")
FAST_MODEL = os.getenv("FAST_MODEL")
VISION_MODEL = os.getenv("VISION_MODEL")

MAX_ITER = int(os.getenv("MAX_ITER", 3))
MAX_TOKENS = int(os.getenv("MAX_TOKENS", 16384))
TEMPERATURE = float(os.getenv("TEMPERATURE", 0.6))
TOP_P = float(os.getenv("TOP_P", 0.95))

TIMEOUT = None

MAX_HISTORY = 20

INJECTION_RE = re.compile(
    r"ignore\s+(previous|all|prior|above)\s+instructions?"
    r"|disregard\s+(instructions?|prompt|system)"
    r"|system\s*prompt\s*:"
    r"|<\|system\|>"
    r"|act\s+as\s+if\s+you\s+are"
    r"|new\s+instructions?\s*:",
    re.IGNORECASE,
)
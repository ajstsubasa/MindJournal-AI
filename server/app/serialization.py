import json
from typing import Any


def to_prompt_text(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2, default=str)

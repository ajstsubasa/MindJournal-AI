from typing import Any

from pydantic import BaseModel


class SummarizeRequest(BaseModel):
    data: Any
    instructions: str | None = None

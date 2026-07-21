from typing import Any

from pydantic import BaseModel


class ConceptsRequest(BaseModel):
    data: Any

from pydantic import BaseModel


class Summary(BaseModel):
    summary: str
    key_points: list[str]

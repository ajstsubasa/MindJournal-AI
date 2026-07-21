from pydantic import BaseModel, Field


class PsychologyConcept(BaseModel):
    name: str
    definition: str


class PsychologyConcepts(BaseModel):
    concepts: list[PsychologyConcept] = Field(min_length=3, max_length=3)

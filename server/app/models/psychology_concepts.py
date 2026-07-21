from pydantic import BaseModel, Field

from app.models.psychology_concept import PsychologyConcept


class PsychologyConcepts(BaseModel):
    concepts: list[PsychologyConcept] = Field(min_length=3, max_length=3)

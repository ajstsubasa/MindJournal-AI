from pydantic import BaseModel


class PsychologyConcept(BaseModel):
    name: str
    definition: str

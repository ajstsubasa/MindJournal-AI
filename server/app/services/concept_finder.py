from typing import Any

from pydantic_ai import Agent

from app.config import MODEL
from app.models.psychology_concepts import PsychologyConcepts
from app.serialization import to_prompt_text

SYSTEM_PROMPT = (
    "Given whatever the user shares (a journal entry, feeling, or situation), "
    "identify exactly 3 psychology concepts most relevant to it and define each "
    "in plain language. Prefer well-established concepts (e.g. cognitive "
    "reframing, rumination, emotional regulation). Order by relevance. Do not "
    "diagnose or give medical advice."
)


class ConceptFinder:
    def __init__(self, model: str = MODEL) -> None:
        self.agent = Agent(model, output_type=PsychologyConcepts, system_prompt=SYSTEM_PROMPT)

    async def run(self, data: Any) -> PsychologyConcepts:
        prompt = f"Find 3 relevant psychology concepts for this input:\n\n{to_prompt_text(data)}"
        result = await self.agent.run(prompt)
        return result.output

from typing import Any

from pydantic_ai import Agent

from app.config import MODEL
from app.models.summary import Summary
from app.serialization import to_prompt_text

SYSTEM_PROMPT = (
    "You summarize whatever data the user sends. Capture the essential meaning "
    "faithfully, stay concise, and never invent facts that are not in the input."
)


class Summarizer:
    def __init__(self, model: str = MODEL) -> None:
        self._agent = Agent(model, output_type=Summary, system_prompt=SYSTEM_PROMPT)

    async def run(self, data: Any, instructions: str | None = None) -> Summary:
        prompt = f"Summarize the following data:\n\n{to_prompt_text(data)}"
        if instructions:
            prompt = f"{instructions.strip()}\n\n{prompt}"
        result = await self._agent.run(prompt)
        return result.output

from pydantic_ai import Agent

from app.config import MODEL
from app.models.weekly_summary import WeeklyJournalEntry, WeeklySummary
from app.serialization import to_prompt_text

SYSTEM_PROMPT = (
    "You create warm, concise weekly reflections from private journal entries. "
    "Faithfully describe only patterns supported by the entries, including mood, "
    "energy, sleep, and recurring themes when they are present. Do not diagnose, "
    "make clinical claims, or shame the person. Offer at most three practical, "
    "gentle next steps. If the entries suggest immediate danger or self-harm, set "
    "support_note to a brief suggestion to contact local emergency services or a "
    "crisis service now; otherwise leave support_note null."
)


class WeeklySummarizer:
    def __init__(self, model: str = MODEL) -> None:
        self.agent = Agent(model, output_type=WeeklySummary, system_prompt=SYSTEM_PROMPT)

    async def run(self, entries: list[WeeklyJournalEntry], week_ending: str) -> WeeklySummary:
        prompt = (
            f"Create a weekly reflection for the seven days ending {week_ending}. "
            "The server does not retain this data. Here are the entries:\n\n"
            f"{to_prompt_text([entry.model_dump() for entry in entries])}"
        )
        result = await self.agent.run(prompt)
        return result.output

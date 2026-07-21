from pydantic import BaseModel, Field


class WeeklyJournalEntry(BaseModel):
    date: str
    content: str = Field(default="", max_length=1500)
    energy: int | None = Field(default=None, ge=1, le=10)
    mood: str | None = Field(default=None, max_length=48)
    sleep: str | None = Field(default=None, max_length=48)


class WeeklySummaryRequest(BaseModel):
    entries: list[WeeklyJournalEntry] = Field(min_length=1, max_length=30)
    week_ending: str


class WeeklySummary(BaseModel):
    overview: str
    patterns: list[str] = Field(min_length=1, max_length=4)
    gentle_next_steps: list[str] = Field(min_length=1, max_length=3)
    affirmation: str
    support_note: str | None = None

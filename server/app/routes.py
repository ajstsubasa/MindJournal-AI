from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.auth import require_api_key
from app.models.concepts_request import ConceptsRequest
from app.models.psychology_concepts import PsychologyConcepts
from app.models.summarize_request import SummarizeRequest
from app.models.summary import Summary
from app.models.weekly_summary import WeeklySummary, WeeklySummaryRequest
from app.services.concept_finder import ConceptFinder
from app.services.summarizer import Summarizer
from app.services.weekly_summarizer import WeeklySummarizer
from app.rate_limit import InMemoryRateLimiter

router = APIRouter()
summarizer = Summarizer()
concept_finder = ConceptFinder()
weekly_summarizer = WeeklySummarizer()
weekly_summary_limiter = InMemoryRateLimiter()


@router.post("/summarize", response_model=Summary, dependencies=[Depends(require_api_key)])
async def summarize(request: SummarizeRequest) -> Summary:
    return await summarizer.run(request.data, request.instructions)


@router.post("/concepts", response_model=PsychologyConcepts, dependencies=[Depends(require_api_key)])
async def concepts(request: ConceptsRequest) -> PsychologyConcepts:
    return await concept_finder.run(request.data)


@router.post("/weekly-summary", response_model=WeeklySummary)
async def weekly_summary(request: Request, payload: WeeklySummaryRequest) -> WeeklySummary:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    client_id = forwarded_for.split(",", 1)[0].strip() or (request.client.host if request.client else "unknown")
    if not weekly_summary_limiter.allow(client_id):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Weekly AI summaries are limited to 6 per hour during the hackathon demo.",
        )
    return await weekly_summarizer.run(payload.entries, payload.week_ending)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

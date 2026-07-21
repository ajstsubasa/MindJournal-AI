from fastapi import APIRouter

from app.models.concepts_request import ConceptsRequest
from app.models.psychology_concepts import PsychologyConcepts
from app.models.summarize_request import SummarizeRequest
from app.models.summary import Summary
from app.services.concept_finder import ConceptFinder
from app.services.summarizer import Summarizer

router = APIRouter()
summarizer = Summarizer()
concept_finder = ConceptFinder()


@router.post("/summarize", response_model=Summary)
async def summarize(request: SummarizeRequest) -> Summary:
    return await summarizer.run(request.data, request.instructions)


@router.post("/concepts", response_model=PsychologyConcepts)
async def concepts(request: ConceptsRequest) -> PsychologyConcepts:
    return await concept_finder.run(request.data)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

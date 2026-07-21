import os

os.environ.setdefault("OPENAI_API_KEY", "test")
os.environ.setdefault("API_KEY", "test")

from contextlib import ExitStack

import pytest
from fastapi.testclient import TestClient
from pydantic_ai import models
from pydantic_ai.models.test import TestModel

import main
from app.routes import concept_finder, summarizer, weekly_summarizer

models.ALLOW_MODEL_REQUESTS = False


@pytest.fixture
def client():
    with ExitStack() as stack:
        stack.enter_context(summarizer.agent.override(model=TestModel()))
        stack.enter_context(concept_finder.agent.override(model=TestModel()))
        stack.enter_context(weekly_summarizer.agent.override(model=TestModel()))
        yield TestClient(main.app, headers={"X-API-Key": "test"})


@pytest.fixture
def unauthenticated_client():
    with ExitStack() as stack:
        stack.enter_context(summarizer.agent.override(model=TestModel()))
        stack.enter_context(concept_finder.agent.override(model=TestModel()))
        stack.enter_context(weekly_summarizer.agent.override(model=TestModel()))
        yield TestClient(main.app)

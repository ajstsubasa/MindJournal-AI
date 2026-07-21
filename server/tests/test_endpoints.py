def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_summarize_returns_summary(client):
    response = client.post("/summarize", json={"data": "a long tiring day at work"})
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["summary"], str)
    assert isinstance(body["key_points"], list)


def test_summarize_accepts_instructions(client):
    response = client.post(
        "/summarize",
        json={"data": ["woke up tired", "felt calm later"], "instructions": "focus on mood"},
    )
    assert response.status_code == 200


def test_summarize_requires_data(client):
    response = client.post("/summarize", json={})
    assert response.status_code == 422


def test_weekly_summary_returns_structured_reflection(unauthenticated_client):
    response = unauthenticated_client.post(
        "/weekly-summary",
        json={
            "week_ending": "2026-07-20",
            "entries": [
                {"date": "2026-07-18", "content": "A gentle walk helped.", "mood": "Good", "energy": 6, "sleep": "Good"}
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["overview"], str)
    assert isinstance(body["patterns"], list)
    assert isinstance(body["gentle_next_steps"], list)


def test_concepts_returns_three_concepts(client):
    response = client.post("/concepts", json={"data": "I keep overthinking an argument"})
    assert response.status_code == 200
    concepts = response.json()["concepts"]
    assert len(concepts) == 3
    for concept in concepts:
        assert concept["name"]
        assert concept["definition"]


def test_concepts_requires_data(client):
    response = client.post("/concepts", json={})
    assert response.status_code == 422


def test_summarize_rejects_missing_api_key(unauthenticated_client):
    response = unauthenticated_client.post("/summarize", json={"data": "x"})
    assert response.status_code == 401


def test_concepts_rejects_wrong_api_key(unauthenticated_client):
    response = unauthenticated_client.post(
        "/concepts", json={"data": "x"}, headers={"X-API-Key": "wrong"}
    )
    assert response.status_code == 401


def test_health_is_public(unauthenticated_client):
    response = unauthenticated_client.get("/health")
    assert response.status_code == 200

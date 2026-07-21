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

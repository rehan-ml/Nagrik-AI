"""
Minimal test suite for Nagrik AI.

These tests deliberately avoid calling the real Gemini API (no network
dependency, no API key required to run) — they cover route wiring,
input validation, and the in-memory complaint store, which is what's
reasonable to unit-test for a 4-hour hackathon build without mocking
out the entire GenAI SDK.

Run with:
    pip install pytest
    pytest test_app.py -v
"""
import pytest
from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def test_index_loads(client):
    """The home page should render successfully."""
    response = client.get("/")
    assert response.status_code == 200


def test_health_endpoint(client):
    """The health check should report ok and the configured model name."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.get_json()
    assert data["ok"] is True
    assert "model" in data


def test_process_rejects_empty_message(client):
    """POSTing an empty citizen_message should fail fast with a 400,
    without ever reaching the Gemini API call."""
    response = client.post("/process", json={"citizen_message": "", "response_language": "English"})
    assert response.status_code == 400
    data = response.get_json()
    assert data["ok"] is False
    assert "error" in data


def test_process_rejects_missing_message(client):
    """POSTing with no citizen_message field at all should also 400."""
    response = client.post("/process", json={"response_language": "English"})
    assert response.status_code == 400


def test_complaints_endpoint_returns_list(client):
    """The complaints tracker should always return a list, even when empty."""
    response = client.get("/complaints")
    assert response.status_code == 200
    data = response.get_json()
    assert data["ok"] is True
    assert isinstance(data["complaints"], list)

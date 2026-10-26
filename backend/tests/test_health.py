from fastapi.testclient import TestClient

from seap_api.main import app

client = TestClient(app)


def test_liveness_is_available_without_database() -> None:
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "alive"}

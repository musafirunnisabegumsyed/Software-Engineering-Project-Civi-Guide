from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_homepage():
    response = client.get("/")
    assert response.status_code == 200
    assert "Welcome to Civi Guide" in response.text

def test_services_page():
    response = client.get("/services")
    assert response.status_code == 200
    assert "Services" in response.text

def test_404_page():
    response = client.get("/unknown")
    assert response.status_code == 404
    assert "Page Not Found" in response.text

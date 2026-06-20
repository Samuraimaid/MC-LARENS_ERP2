import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001")


def test_drafts_backup_crud():
    url = f"{BASE_URL}/api/drafts/backup"

    # Ensure clean state
    try:
        requests.delete(url, timeout=5)
    except Exception:
        pass

    entries = [{"id": "a", "text": "one"}, {"id": "b", "text": "two"}]

    # Create/POST
    r = requests.post(url, json={"entries": entries}, timeout=5)
    assert r.status_code == 200, f"POST failed: {r.status_code} {r.text}"

    # Read/GET
    r = requests.get(url, timeout=5)
    assert r.status_code == 200, f"GET failed: {r.status_code} {r.text}"
    data = r.json()
    assert "entries" in data
    assert isinstance(data["entries"], list)
    assert data["entries"] == entries

    # Delete
    r = requests.delete(url, timeout=5)
    assert r.status_code == 200, f"DELETE failed: {r.status_code} {r.text}"

    # Verify deleted
    r = requests.get(url, timeout=5)
    assert r.status_code == 200
    data = r.json()
    assert data.get("entries", []) == []

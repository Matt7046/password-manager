"""Backend tests for Password Manager - auth setup/login and CRUD flows.

Bug context: user reported that after setup they cannot login.
These tests explicitly reproduce the reported user journey.
"""
import pytest
from pymongo import MongoClient
import os


@pytest.fixture(scope="module", autouse=True)
def ensure_fresh_setup(api_client, base_url, master_password):
    """Ensure DB is clean and master password is set up before tests in this module."""
    client = MongoClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    # Only reset if we haven't already set up TEST_ scenario in this run
    if db.users.count_documents({"user_id": "master_user"}) == 0:
        # Confirm truly empty
        db.users.delete_many({})
        db.password_entries.delete_many({})
        r = api_client.post(
            f"{base_url}/api/auth/setup",
            json={"master_password": master_password},
        )
        # Ignore if concurrent worker already set it up
    client.close()
    yield


# --------- Auth: setup and login (main bug scenario) ---------

class TestAuthSetupLoginFlow:
    def test_01_check_after_setup_returns_true(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/auth/check")
        assert r.status_code == 200
        assert r.json()["is_setup"] is True

    def test_02_setup_twice_rejected(self, api_client, base_url, master_password):
        r = api_client.post(
            f"{base_url}/api/auth/setup",
            json={"master_password": master_password},
        )
        assert r.status_code == 400

    def test_03_login_with_correct_password(self, api_client, base_url, master_password):
        r = api_client.post(
            f"{base_url}/api/auth/login",
            json={"master_password": master_password},
        )
        assert r.status_code == 200, r.text
        assert r.json()["success"] is True

    def test_04_login_with_wrong_password_rejected(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/auth/login",
            json={"master_password": "wrongpass"},
        )
        assert r.status_code == 401


# --------- Categories (public) ---------

class TestCategories:
    def test_get_categories(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/categories")
        assert r.status_code == 200
        cats = r.json()["categories"]
        assert isinstance(cats, list) and len(cats) > 0


# --------- Password Entries CRUD ---------

_state = {}


@pytest.mark.usefixtures("ensure_fresh_setup")
class TestPasswordCrud:
    def test_01_create_entry(self, api_client, base_url, master_password):
        payload = {
            "account_name": "TEST_Gmail",
            "username": "test@example.com",
            "password": "supersecret",
            "url": "https://gmail.com",
            "notes": "Personal email",
            "category": "Email",
            "tags": ["personal"],
            "master_password": master_password,
        }
        r = api_client.post(f"{base_url}/api/passwords", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["account_name"] == "TEST_Gmail"
        assert data["password"] == "supersecret"  # returned decrypted
        assert data["category"] == "Email"
        _state["id"] = data["id"]

    def test_02_get_all_passwords(self, api_client, base_url, master_password):
        r = api_client.get(
            f"{base_url}/api/passwords",
            params={"master_password": master_password},
        )
        assert r.status_code == 200
        entries = r.json()
        assert any(e["id"] == _state["id"] for e in entries)

    def test_03_get_single_entry(self, api_client, base_url, master_password):
        r = api_client.get(
            f"{base_url}/api/passwords/{_state['id']}",
            params={"master_password": master_password},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["password"] == "supersecret"

    def test_04_wrong_password_rejected_on_get(self, api_client, base_url):
        r = api_client.get(
            f"{base_url}/api/passwords",
            params={"master_password": "wrongpass"},
        )
        assert r.status_code == 401

    def test_05_update_entry(self, api_client, base_url, master_password):
        r = api_client.put(
            f"{base_url}/api/passwords/{_state['id']}",
            json={
                "password": "newsecret",
                "notes": "Updated",
                "master_password": master_password,
            },
        )
        assert r.status_code == 200
        assert r.json()["password"] == "newsecret"

        # Verify persistence
        r2 = api_client.get(
            f"{base_url}/api/passwords/{_state['id']}",
            params={"master_password": master_password},
        )
        assert r2.status_code == 200
        assert r2.json()["password"] == "newsecret"
        assert r2.json()["notes"] == "Updated"

    def test_06_search(self, api_client, base_url, master_password):
        r = api_client.post(
            f"{base_url}/api/passwords/search",
            json={"query": "gmail", "master_password": master_password},
        )
        assert r.status_code == 200
        results = r.json()
        assert any(e["id"] == _state["id"] for e in results)

    def test_07_delete_entry(self, api_client, base_url, master_password):
        r = api_client.delete(
            f"{base_url}/api/passwords/{_state['id']}",
            params={"master_password": master_password},
        )
        assert r.status_code == 200

        # Verify deletion
        r2 = api_client.get(
            f"{base_url}/api/passwords/{_state['id']}",
            params={"master_password": master_password},
        )
        assert r2.status_code == 404

    def test_08_invalid_id_format(self, api_client, base_url, master_password):
        r = api_client.get(
            f"{base_url}/api/passwords/not-an-id",
            params={"master_password": master_password},
        )
        assert r.status_code == 400

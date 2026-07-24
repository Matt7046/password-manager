"""Tests for the new DELETE /api/auth/reset endpoint.

Reset endpoint deletes all users and password entries. Used when user forgets
master password. This test module must run AFTER test_auth_and_crud.py because
it wipes DB state.
"""
import os
import pytest
from pymongo import MongoClient


NEW_PASSWORD = "NewPass456"


class TestResetFlow:
    """End-to-end reset flow: setup → create data → reset → verify empty → setup again."""

    def test_01_precondition_setup_exists(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/auth/check")
        assert r.status_code == 200
        # ensure we have a user to reset (test_auth_and_crud left one)
        # If not, set one up here
        if not r.json()["is_setup"]:
            api_client.post(
                f"{base_url}/api/auth/setup",
                json={"master_password": "TestPass123"},
            )
            r = api_client.get(f"{base_url}/api/auth/check")
        assert r.json()["is_setup"] is True

    def test_02_seed_a_password_entry(self, api_client, base_url):
        """Seed at least one entry to verify it gets wiped by reset."""
        payload = {
            "account_name": "TEST_ResetSeed",
            "username": "reset@example.com",
            "password": "willbedeleted",
            "url": "",
            "notes": "",
            "category": "Other",
            "tags": [],
            "master_password": "TestPass123",
        }
        r = api_client.post(f"{base_url}/api/passwords", json=payload)
        assert r.status_code == 200, r.text

    def test_03_reset_returns_success(self, api_client, base_url):
        r = api_client.delete(f"{base_url}/api/auth/reset")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert "reset" in data["message"].lower()

    def test_04_check_returns_is_setup_false(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/auth/check")
        assert r.status_code == 200
        assert r.json()["is_setup"] is False

    def test_05_db_collections_empty(self):
        client = MongoClient(os.environ["MONGO_URL"])
        db = client[os.environ["DB_NAME"]]
        assert db.users.count_documents({}) == 0
        assert db.password_entries.count_documents({}) == 0
        client.close()

    def test_06_login_after_reset_fails_404(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/auth/login",
            json={"master_password": "TestPass123"},
        )
        assert r.status_code == 404

    def test_07_setup_new_master_password(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/auth/setup",
            json={"master_password": NEW_PASSWORD},
        )
        assert r.status_code == 200, r.text
        assert r.json()["user_id"] == "master_user"

    def test_08_login_with_new_password(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/auth/login",
            json={"master_password": NEW_PASSWORD},
        )
        assert r.status_code == 200, r.text
        assert r.json()["success"] is True

    def test_09_old_password_no_longer_works(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/auth/login",
            json={"master_password": "TestPass123"},
        )
        assert r.status_code == 401

    def test_10_reset_idempotent_when_no_users(self, api_client, base_url):
        """Second reset call should still succeed even if collections are empty."""
        # Reset current state first
        api_client.delete(f"{base_url}/api/auth/reset")
        # Call again on empty DB
        r = api_client.delete(f"{base_url}/api/auth/reset")
        assert r.status_code == 200
        assert r.json()["success"] is True
        # verify check
        c = api_client.get(f"{base_url}/api/auth/check")
        assert c.json()["is_setup"] is False

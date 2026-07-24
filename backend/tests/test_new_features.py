"""Backend tests for Password Manager (post master-password-reset architecture).

CRITICAL BUG FIX under test (Jan 2026):
    After master-password reset via OTP, previously saved password entries
    MUST be preserved and remain decryptable. Entries are encrypted with a
    key derived from `email + SERVER_SECRET` instead of the master password.

Tests are kept in a single module so pytest-xdist `--dist loadscope`
pins them to one worker (they share MongoDB state).
"""
from datetime import datetime, timedelta

import pytest


ITALIAN_CATEGORIES = {
    "Social Media", "Email", "Banca", "Acquisti", "Lavoro",
    "Intrattenimento", "Videogiochi", "Viaggi", "Istruzione",
    "Salute", "Altro",
}

TEST_EMAIL = "test@example.com"
OLD_PASSWORD = "OldPass123"
NEW_PASSWORD = "NewPass456"


# ---------- 1. Categories ----------
class TestCategoriesItalian:
    def test_categories_are_italian(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/categories")
        assert r.status_code == 200
        assert set(r.json()["categories"]) == ITALIAN_CATEGORIES


# ---------- 2. /auth/check when nothing is set up ----------
class TestCheckBeforeSetup:
    def test_check_returns_false_and_empty_email(self, api_client, base_url, mongo_db):
        mongo_db.users.delete_many({})
        mongo_db.password_entries.delete_many({})
        mongo_db.otp_codes.delete_many({})
        r = api_client.get(f"{base_url}/api/auth/check")
        assert r.status_code == 200
        assert r.json() == {"is_setup": False, "email": ""}


# ---------- 3. Setup + Login ----------
class TestSetupWithEmail:
    def test_01_setup_requires_email(self, api_client, base_url, mongo_db):
        mongo_db.users.delete_many({})
        r = api_client.post(f"{base_url}/api/auth/setup",
                            json={"master_password": OLD_PASSWORD})
        assert r.status_code == 422

    def test_02_setup_rejects_invalid_email(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/setup",
                            json={"email": "not-an-email",
                                  "master_password": OLD_PASSWORD})
        assert r.status_code == 422

    def test_03_setup_success(self, api_client, base_url, mongo_db):
        mongo_db.users.delete_many({})
        r = api_client.post(f"{base_url}/api/auth/setup",
                            json={"email": TEST_EMAIL,
                                  "master_password": OLD_PASSWORD})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user_id"] == "master_user"
        assert d["email"] == TEST_EMAIL
        assert mongo_db.users.find_one({"user_id": "master_user"})["email"] == TEST_EMAIL

    def test_04_check_returns_true_and_email(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/auth/check")
        assert r.status_code == 200
        d = r.json()
        assert d["is_setup"] is True
        assert d["email"] == TEST_EMAIL

    def test_05_setup_twice_rejected(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/setup",
                            json={"email": TEST_EMAIL,
                                  "master_password": OLD_PASSWORD})
        assert r.status_code == 400

    def test_06_login_with_correct_email_and_password(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/login",
                            json={"email": TEST_EMAIL, "master_password": OLD_PASSWORD})
        assert r.status_code == 200
        assert r.json()["success"] is True

    def test_07_login_wrong_password(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/login",
                            json={"email": TEST_EMAIL, "master_password": "wrong"})
        assert r.status_code == 401
        assert "Email o password non validi" in r.json()["detail"]

    def test_08_login_wrong_email(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/login",
                            json={"email": "someoneelse@example.com",
                                  "master_password": OLD_PASSWORD})
        assert r.status_code == 401
        assert "Email o password non validi" in r.json()["detail"]

    def test_09_login_missing_email_422(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/login",
                            json={"master_password": OLD_PASSWORD})
        assert r.status_code == 422

    def test_10_login_invalid_email_format_422(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/login",
                            json={"email": "not-an-email",
                                  "master_password": OLD_PASSWORD})
        assert r.status_code == 422

    def test_11_login_email_case_insensitive(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/login",
                            json={"email": TEST_EMAIL.upper(),
                                  "master_password": OLD_PASSWORD})
        assert r.status_code == 200
        assert r.json()["success"] is True


# ---------- 4. Forgot-password ----------
class TestForgotPassword:
    def test_01_wrong_email(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/forgot-password",
                            json={"email": "someone-else@example.com"})
        assert r.status_code == 404

    def test_02_invalid_email_format(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/forgot-password",
                            json={"email": "not-an-email"})
        assert r.status_code == 422

    def test_03_valid_email_creates_otp(self, api_client, base_url, mongo_db):
        mongo_db.otp_codes.delete_many({})
        r = api_client.post(f"{base_url}/api/auth/forgot-password",
                            json={"email": TEST_EMAIL})
        if r.status_code == 500:
            pytest.skip(f"Resend send failed in CI env: {r.text}")
        assert r.status_code == 200
        otp = mongo_db.otp_codes.find_one({"email": TEST_EMAIL})
        assert otp is not None
        assert len(otp["otp_code"]) == 6 and otp["otp_code"].isdigit()


# ---------- 5. Verify-OTP-reset — basic guardrails ----------
class TestVerifyOtpResetGuards:
    def test_01_invalid_otp_rejected(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/verify-otp-reset",
                            json={"email": TEST_EMAIL, "otp_code": "000000",
                                  "new_master_password": NEW_PASSWORD})
        assert r.status_code == 400

    def test_02_expired_otp_rejected(self, api_client, base_url, mongo_db):
        mongo_db.otp_codes.delete_many({"email": TEST_EMAIL})
        mongo_db.otp_codes.insert_one({
            "email": TEST_EMAIL,
            "otp_code": "999999",
            "created_at": datetime.utcnow() - timedelta(minutes=20),
            "expires_at": datetime.utcnow() - timedelta(minutes=10),
        })
        r = api_client.post(f"{base_url}/api/auth/verify-otp-reset",
                            json={"email": TEST_EMAIL, "otp_code": "999999",
                                  "new_master_password": NEW_PASSWORD})
        assert r.status_code == 400
        # Expired OTP cleaned up
        assert mongo_db.otp_codes.find_one({"email": TEST_EMAIL, "otp_code": "999999"}) is None


# =============================================================================
# CRITICAL BUG FIX: Master-password reset must PRESERVE saved password entries.
# =============================================================================
SEED_ENTRIES = [
    {"account_name": "TEST_Gmail",    "username": "alice@gmail.com",
     "password": "GmailPlainPwd!42",  "url": "https://gmail.com",
     "notes": "primary", "category": "Email",         "tags": ["personal"]},
    {"account_name": "TEST_Facebook", "username": "alice.fb",
     "password": "FbSuperSecret#77",  "url": "https://facebook.com",
     "notes": "",        "category": "Social Media",  "tags": ["social"]},
    {"account_name": "TEST_Amazon",   "username": "alice_amz",
     "password": "AmzShop$2025",      "url": "https://amazon.com",
     "notes": "family",  "category": "Acquisti",      "tags": ["shopping", "family"]},
]


class TestResetPreservesEntries:
    """CRITICAL E2E test of the master-password-reset bug fix.

    Consolidated into ONE atomic test method so pytest-xdist (--dist loadscope)
    runs the entire flow on a single worker without another class interleaving
    DB writes. Each assertion has a distinct failure message.
    """

    def test_full_reset_preserves_entries_flow(self, api_client, base_url, mongo_db):
        # ---- 1. Fresh setup with OldPass123 ----
        mongo_db.users.delete_many({})
        mongo_db.password_entries.delete_many({})
        mongo_db.otp_codes.delete_many({})
        r = api_client.post(
            f"{base_url}/api/auth/setup",
            json={"email": TEST_EMAIL, "master_password": OLD_PASSWORD},
        )
        assert r.status_code == 200, f"setup: {r.text}"

        # ---- 2. Add 3 password entries ----
        for entry in SEED_ENTRIES:
            r = api_client.post(
                f"{base_url}/api/passwords",
                json={**entry, "master_password": OLD_PASSWORD},
            )
            assert r.status_code == 200, f"create {entry['account_name']}: {r.text}"
            body = r.json()
            assert body["account_name"] == entry["account_name"]
            assert body["password"] == entry["password"], "plaintext echo"

        # ---- 3. List returns 3 entries with correct plaintext ----
        r = api_client.get(
            f"{base_url}/api/passwords", params={"master_password": OLD_PASSWORD}
        )
        assert r.status_code == 200, f"list before reset: {r.text}"
        entries = r.json()
        assert len(entries) == 3
        got = {e["account_name"]: e["password"] for e in entries}
        for e in SEED_ENTRIES:
            assert got[e["account_name"]] == e["password"]

        # ---- 4. DB stores ciphertext, not plaintext ----
        docs = list(mongo_db.password_entries.find())
        assert len(docs) == 3
        plaintexts = {e["password"] for e in SEED_ENTRIES}
        for d in docs:
            assert d["password"] not in plaintexts, "plaintext password in DB!"
            assert d["password"].startswith("gAAAA"), "not a Fernet token"
        before_ids = {str(d["_id"]) for d in docs}

        # ---- 5. Forgot-password → obtain OTP ----
        mongo_db.otp_codes.delete_many({})
        r = api_client.post(
            f"{base_url}/api/auth/forgot-password", json={"email": TEST_EMAIL}
        )
        if r.status_code == 500:
            # Resend often fails in CI (unverified sender). Seed OTP directly.
            mongo_db.otp_codes.insert_one({
                "email": TEST_EMAIL, "otp_code": "424242",
                "created_at": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(minutes=10),
            })
        else:
            assert r.status_code == 200, f"forgot-password: {r.text}"
        otp_doc = mongo_db.otp_codes.find_one({"email": TEST_EMAIL})
        assert otp_doc is not None and len(otp_doc["otp_code"]) == 6
        otp_code = otp_doc["otp_code"]

        # ---- 6. Verify-OTP-reset: MUST preserve entries ----
        r = api_client.post(
            f"{base_url}/api/auth/verify-otp-reset",
            json={"email": TEST_EMAIL, "otp_code": otp_code,
                  "new_master_password": NEW_PASSWORD},
        )
        assert r.status_code == 200, f"verify-otp-reset: {r.text}"
        assert r.json()["success"] is True

        # OTP consumed
        assert mongo_db.otp_codes.find_one({"email": TEST_EMAIL}) is None

        # Entries survive with SAME _ids (proves not deleted/replaced)
        after_ids = {str(d["_id"]) for d in mongo_db.password_entries.find({}, {"_id": 1})}
        assert after_ids == before_ids, (
            f"BUG NOT FIXED: entries were mutated. before={before_ids} after={after_ids}"
        )

        # User doc still there, email unchanged
        u = mongo_db.users.find_one({"user_id": "master_user"})
        assert u is not None and u["email"] == TEST_EMAIL

        # ---- 7. Old password rejected ----
        r = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": TEST_EMAIL, "master_password": OLD_PASSWORD},
        )
        assert r.status_code == 401, "old password should not work"

        # ---- 8. New password accepted ----
        r = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": TEST_EMAIL, "master_password": NEW_PASSWORD},
        )
        assert r.status_code == 200 and r.json()["success"] is True

        # ---- 9. Entries still decryptable with the new password ----
        r = api_client.get(
            f"{base_url}/api/passwords", params={"master_password": NEW_PASSWORD}
        )
        assert r.status_code == 200, f"list after reset: {r.text}"
        entries = r.json()
        assert len(entries) == 3, (
            f"BUG NOT FIXED: expected 3 preserved entries, got {len(entries)}"
        )
        got = {e["account_name"]: e["password"] for e in entries}
        for e in SEED_ENTRIES:
            assert got[e["account_name"]] == e["password"], (
                f"decrypt mismatch for {e['account_name']}: "
                f"expected {e['password']}, got {got.get(e['account_name'])}"
            )

        # ---- 10. Add / GET / update / delete new entry with NEW password ----
        r = api_client.post(
            f"{base_url}/api/passwords",
            json={"account_name": "TEST_AfterReset", "username": "post",
                  "password": "AfterResetPwd!", "category": "Altro",
                  "tags": [], "master_password": NEW_PASSWORD},
        )
        assert r.status_code == 200, f"add after reset: {r.text}"
        new_id = r.json()["id"]

        r = api_client.get(
            f"{base_url}/api/passwords/{new_id}",
            params={"master_password": NEW_PASSWORD},
        )
        assert r.status_code == 200
        assert r.json()["password"] == "AfterResetPwd!"

        r = api_client.put(
            f"{base_url}/api/passwords/{new_id}",
            json={"password": "UpdatedAfterReset!",
                  "master_password": NEW_PASSWORD},
        )
        assert r.status_code == 200
        assert r.json()["password"] == "UpdatedAfterReset!"

        r = api_client.delete(
            f"{base_url}/api/passwords/{new_id}",
            params={"master_password": NEW_PASSWORD},
        )
        assert r.status_code == 200
        r = api_client.get(
            f"{base_url}/api/passwords/{new_id}",
            params={"master_password": NEW_PASSWORD},
        )
        assert r.status_code == 404

        # ---- 11. Original 3 entries still untouched ----
        r = api_client.get(
            f"{base_url}/api/passwords", params={"master_password": NEW_PASSWORD}
        )
        assert r.status_code == 200
        names = {e["account_name"] for e in r.json()}
        assert names == {"TEST_Gmail", "TEST_Facebook", "TEST_Amazon"}

        # ---- 12. Search still works after reset ----
        r = api_client.post(
            f"{base_url}/api/passwords/search",
            json={"query": "Gmail", "master_password": NEW_PASSWORD},
        )
        assert r.status_code == 200
        results = r.json()
        assert len(results) == 1
        assert results[0]["account_name"] == "TEST_Gmail"
        assert results[0]["password"] == "GmailPlainPwd!42"

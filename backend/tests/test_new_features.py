"""Backend tests for the new features:
  - setup with email + master_password
  - forgot-password (OTP via Resend + Mongo)
  - verify-otp-reset (deletes existing user + entries, creates new user)
  - /auth/check now returns is_setup + email
  - /categories returns Italian names

Email delivery through Resend cannot be reliably verified from CI, but the OTP
code is persisted in the `otp_codes` collection which we assert directly.
"""
import pytest


ITALIAN_CATEGORIES = {
    "Social Media", "Email", "Banca", "Acquisti", "Lavoro",
    "Intrattenimento", "Videogiochi", "Viaggi", "Istruzione",
    "Salute", "Altro",
}


# --------- Categories in Italian ---------
class TestCategoriesItalian:
    def test_categories_are_italian(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/categories")
        assert r.status_code == 200
        cats = r.json()["categories"]
        assert set(cats) == ITALIAN_CATEGORIES, f"Got: {cats}"


# --------- /auth/check when nothing is setup ---------
class TestCheckBeforeSetup:
    def test_check_returns_false_and_empty_email(self, api_client, base_url, mongo_db):
        # Ensure completely clean
        mongo_db.users.delete_many({})
        r = api_client.get(f"{base_url}/api/auth/check")
        assert r.status_code == 200
        data = r.json()
        assert data["is_setup"] is False
        assert data["email"] == ""


# --------- Setup with email + password ---------
class TestSetupWithEmail:
    def test_01_setup_requires_email(self, api_client, base_url, master_password, mongo_db):
        mongo_db.users.delete_many({})
        r = api_client.post(
            f"{base_url}/api/auth/setup",
            json={"master_password": master_password},  # missing email
        )
        assert r.status_code == 422

    def test_02_setup_rejects_invalid_email(self, api_client, base_url, master_password):
        r = api_client.post(
            f"{base_url}/api/auth/setup",
            json={"email": "not-an-email", "master_password": master_password},
        )
        assert r.status_code == 422

    def test_03_setup_success(self, api_client, base_url, test_email, master_password, mongo_db):
        mongo_db.users.delete_many({})
        r = api_client.post(
            f"{base_url}/api/auth/setup",
            json={"email": test_email, "master_password": master_password},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user_id"] == "master_user"
        assert data["email"] == test_email
        # Verify persistence
        user = mongo_db.users.find_one({"user_id": "master_user"})
        assert user is not None
        assert user["email"] == test_email

    def test_04_check_returns_true_and_email(self, api_client, base_url, test_email):
        r = api_client.get(f"{base_url}/api/auth/check")
        assert r.status_code == 200
        data = r.json()
        assert data["is_setup"] is True
        assert data["email"] == test_email

    def test_05_setup_twice_rejected(self, api_client, base_url, test_email, master_password):
        r = api_client.post(
            f"{base_url}/api/auth/setup",
            json={"email": test_email, "master_password": master_password},
        )
        assert r.status_code == 400

    def test_06_login_with_correct_password(self, api_client, base_url, master_password):
        r = api_client.post(f"{base_url}/api/auth/login",
                            json={"master_password": master_password})
        assert r.status_code == 200, r.text
        assert r.json()["success"] is True

    def test_07_login_wrong_password(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/auth/login",
                            json={"master_password": "wrong"})
        assert r.status_code == 401


# --------- Forgot password ---------
class TestForgotPassword:
    def test_01_forgot_password_wrong_email(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/auth/forgot-password",
            json={"email": "someone-else@example.com"},
        )
        assert r.status_code == 404

    def test_02_forgot_password_invalid_email_format(self, api_client, base_url):
        r = api_client.post(
            f"{base_url}/api/auth/forgot-password",
            json={"email": "not-an-email"},
        )
        assert r.status_code == 422

    def test_03_forgot_password_success_creates_otp(self, api_client, base_url, test_email, mongo_db):
        # Clear any old OTPs
        mongo_db.otp_codes.delete_many({})
        r = api_client.post(
            f"{base_url}/api/auth/forgot-password",
            json={"email": test_email},
        )
        # If Resend returns error at send-time, backend responds 500. In that
        # case, still verify how far we got and skip further tests with a
        # helpful message so the main agent can act.
        if r.status_code == 500:
            pytest.skip(f"Resend email send failed in this env: {r.text}")
        assert r.status_code == 200, r.text
        assert r.json()["success"] is True
        otp = mongo_db.otp_codes.find_one({"email": test_email})
        assert otp is not None
        assert len(otp["otp_code"]) == 6
        assert otp["otp_code"].isdigit()


# --------- Verify OTP reset ---------
class TestVerifyOtpReset:
    def test_01_invalid_otp_rejected(self, api_client, base_url, test_email, new_password):
        r = api_client.post(
            f"{base_url}/api/auth/verify-otp-reset",
            json={"email": test_email, "otp_code": "000000",
                  "new_master_password": new_password},
        )
        assert r.status_code == 400

    def test_02_reset_with_valid_otp(self, api_client, base_url, test_email,
                                     master_password, new_password, mongo_db):
        # Seed a valid OTP directly (avoids Resend dependency)
        from datetime import datetime, timedelta
        mongo_db.otp_codes.delete_many({"email": test_email})
        mongo_db.otp_codes.insert_one({
            "email": test_email,
            "otp_code": "123456",
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(minutes=10),
        })

        # Add one password entry to verify wipe
        entry_payload = {
            "account_name": "TEST_ToBeDeleted",
            "username": "u",
            "password": "p",
            "category": "Email",
            "tags": [],
            "master_password": master_password,
        }
        r = api_client.post(f"{base_url}/api/passwords", json=entry_payload)
        assert r.status_code == 200, r.text

        # Perform reset
        r = api_client.post(
            f"{base_url}/api/auth/verify-otp-reset",
            json={"email": test_email, "otp_code": "123456",
                  "new_master_password": new_password},
        )
        assert r.status_code == 200, r.text
        assert r.json()["success"] is True

        # OTP consumed
        assert mongo_db.otp_codes.find_one({"email": test_email}) is None

        # Password entries wiped
        assert mongo_db.password_entries.count_documents({}) == 0

        # New user exists with new password
        r = api_client.post(f"{base_url}/api/auth/login",
                            json={"master_password": new_password})
        assert r.status_code == 200, r.text

        # Old password no longer works
        r = api_client.post(f"{base_url}/api/auth/login",
                            json={"master_password": master_password})
        assert r.status_code == 401

        # Email still returned by /auth/check
        r = api_client.get(f"{base_url}/api/auth/check")
        assert r.status_code == 200
        assert r.json()["email"] == test_email

    def test_03_expired_otp_rejected(self, api_client, base_url, test_email,
                                     new_password, mongo_db):
        from datetime import datetime, timedelta
        mongo_db.otp_codes.delete_many({"email": test_email})
        mongo_db.otp_codes.insert_one({
            "email": test_email,
            "otp_code": "999999",
            "created_at": datetime.utcnow() - timedelta(minutes=20),
            "expires_at": datetime.utcnow() - timedelta(minutes=10),
        })
        r = api_client.post(
            f"{base_url}/api/auth/verify-otp-reset",
            json={"email": test_email, "otp_code": "999999",
                  "new_master_password": new_password},
        )
        assert r.status_code == 400
        # Expired OTP should be cleaned up
        assert mongo_db.otp_codes.find_one({"email": test_email, "otp_code": "999999"}) is None

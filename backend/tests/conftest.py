import os
import pytest
import requests
from pymongo import MongoClient
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / ".env")

_frontend_env = Path(__file__).parent.parent.parent / "frontend" / ".env"
if _frontend_env.exists():
    load_dotenv(_frontend_env, override=False)

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "OldPass123"
NEW_PASSWORD = "NewPass456"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def mongo_db():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="session", autouse=True)
def clean_db(mongo_db):
    """Reset DB before session starts."""
    mongo_db.users.delete_many({})
    mongo_db.password_entries.delete_many({})
    mongo_db.otp_codes.delete_many({})
    yield


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def test_email():
    return TEST_EMAIL


@pytest.fixture(scope="session")
def master_password():
    return TEST_PASSWORD


@pytest.fixture(scope="session")
def new_password():
    return NEW_PASSWORD

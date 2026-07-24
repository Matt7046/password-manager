from fastapi import FastAPI, APIRouter, HTTPException, status
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timedelta
from passlib.context import CryptContext
from cryptography.fernet import Fernet
import base64
import hashlib
import random
import string
from bson import ObjectId
from bson.errors import InvalidId
import resend

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB — same Atlas cluster as Activity Manager; dedicated DB_NAME (not MONGO_DB=demo)
mongo_url = os.environ.get('MONGO_URL') or os.environ.get('MONGO_URI')
if not mongo_url:
    raise RuntimeError('Set MONGO_URL or MONGO_URI (reuse Activity Manager Mongo connection string)')

db_name = os.environ.get('DB_NAME') or os.environ.get('MONGO_DB_PASSWORD') or 'password_manager'

# X509 client certs (same files Activity Manager mounts under /app/certificate)
mongo_cert = os.environ.get('MONGO_CERT_PATH', '/app/certificate/client.pem')
mongo_key = os.environ.get('MONGO_KEY_PATH', '/app/certificate/client-key.pem')

mongo_kwargs = {}
if Path(mongo_cert).is_file() and Path(mongo_key).is_file():
    # PyMongo wants cert+key in one PEM for tlsCertificateKeyFile
    combined = Path('/tmp/mongo-client-combined.pem')
    combined.write_text(
        Path(mongo_cert).read_text(encoding='utf-8')
        + '\n'
        + Path(mongo_key).read_text(encoding='utf-8'),
        encoding='utf-8',
    )
    mongo_kwargs['tls'] = True
    mongo_kwargs['tlsCertificateKeyFile'] = str(combined)
elif 'X509' in mongo_url.upper() or 'MONGODB-X509' in mongo_url.upper():
    raise RuntimeError(
        f'X509 URI detected but cert/key not found at {mongo_cert} / {mongo_key}. '
        'Mount Activity Manager certificate folder into the container.'
    )

client = AsyncIOMotorClient(mongo_url, **mongo_kwargs)
db = client[db_name]

# Resend setup (optional — forgot-password needs a key; free tier is enough)
resend.api_key = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
SERVER_SECRET = os.environ.get('SERVER_SECRET', '')
if not SERVER_SECRET:
    logging.warning('SERVER_SECRET is empty — set a long random secret before production use')

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Encryption setup - generate key from email + server secret
# This allows password entries to remain accessible after master password reset
def get_encryption_key(email: str) -> bytes:
    """Generate a consistent encryption key from email + server secret"""
    combined = f"{email.lower()}:{SERVER_SECRET}"
    key = hashlib.sha256(combined.encode()).digest()
    return base64.urlsafe_b64encode(key)

def encrypt_password(password: str, email: str) -> str:
    """Encrypt a password using email-derived key"""
    key = get_encryption_key(email)
    f = Fernet(key)
    return f.encrypt(password.encode()).decode()

def decrypt_password(encrypted_password: str, email: str) -> str:
    """Decrypt a password using email-derived key"""
    key = get_encryption_key(email)
    f = Fernet(key)
    return f.decrypt(encrypted_password.encode()).decode()

def generate_otp() -> str:
    """Generate a 6-digit OTP code"""
    return ''.join(random.choices(string.digits, k=6))

def send_otp_email(to_email: str, otp_code: str) -> bool:
    """Send OTP code via Resend (skipped if RESEND_API_KEY is not configured)"""
    if not resend.api_key:
        logging.error('RESEND_API_KEY not set — cannot send OTP email')
        return False
    try:
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: #1a1a2e; padding: 30px; border-radius: 12px;">
                    <h1 style="color: #4ecdc4; text-align: center;">🔐 Password Manager</h1>
                    <h2 style="color: #fff; text-align: center;">Codice di Reset Password</h2>
                    <p style="color: #ccc; font-size: 16px; text-align: center;">
                        Hai richiesto il reset della tua password master. Utilizza il codice seguente:
                    </p>
                    <div style="background: #16213e; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4ecdc4;">{otp_code}</span>
                    </div>
                    <p style="color: #999; font-size: 14px; text-align: center;">
                        Questo codice è valido per 10 minuti.<br/>
                        Se non hai richiesto questo reset, ignora questa email.
                    </p>
                    <p style="color: #4ecdc4; font-size: 12px; text-align: center; margin-top: 30px;">
                        ✓ Le tue password salvate saranno preservate dopo il reset.
                    </p>
                </div>
            </body>
        </html>
        """
        params = {
            "from": SENDER_EMAIL,
            "to": [to_email],
            "subject": "🔐 Codice di Reset - Password Manager",
            "html": html_content,
        }
        response = resend.Emails.send(params)
        logging.info(f"OTP email sent to {to_email}: {response}")
        return True
    except Exception as e:
        logging.error(f"Failed to send OTP email: {str(e)}")
        return False

# Create the main app without a prefix
# Behind nginx: https://activity-manager.colorsdev.tech/password-manager/ → this service
app = FastAPI(title="Password Manager API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

@api_router.get("/health")
async def health():
    return {"status": "ok", "db": db_name}

# ============ Models ============

class UserCreate(BaseModel):
    email: EmailStr
    master_password: str

class UserLogin(BaseModel):
    email: EmailStr
    master_password: str

class UserResponse(BaseModel):
    user_id: str
    email: str
    created_at: datetime

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class VerifyOTPResetRequest(BaseModel):
    email: EmailStr
    otp_code: str
    new_master_password: str

class PasswordEntryCreate(BaseModel):
    account_name: str
    username: str
    password: str
    url: Optional[str] = ""
    notes: Optional[str] = ""
    category: str
    tags: List[str] = []
    master_password: str
    email: EmailStr

class PasswordEntryUpdate(BaseModel):
    account_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    url: Optional[str] = None
    notes: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    master_password: str
    email: EmailStr

class PasswordEntryResponse(BaseModel):
    id: str
    account_name: str
    username: str
    password: str
    url: str
    notes: str
    category: str
    tags: List[str]
    created_at: datetime
    updated_at: datetime

class SearchRequest(BaseModel):
    query: str
    master_password: str
    email: EmailStr


async def migrate_legacy_users():
    """Migrate single master_user + unscoped entries to per-email ownership."""
    legacy = await db.users.find_one({"user_id": "master_user"})
    if legacy and legacy.get("email"):
        email = legacy["email"].lower()
        await db.users.update_one(
            {"_id": legacy["_id"]},
            {"$set": {"user_id": email, "email": email}},
        )
        await db.password_entries.update_many(
            {"owner_email": {"$exists": False}},
            {"$set": {"owner_email": email}},
        )


async def get_user_by_email(email: str):
    await migrate_legacy_users()
    return await db.users.find_one({"email": email.lower()})


async def authenticate_user(email: str, master_password: str):
    user = await get_user_by_email(email)
    if not user or not pwd_context.verify(master_password, user["master_password"]):
        raise HTTPException(status_code=401, detail="Email o password non validi")
    return user


# ============ Auth Routes ============

@api_router.post("/auth/setup", response_model=UserResponse)
async def setup_master_password(user: UserCreate):
    """Create a new vault account for this email (multi-user)."""
    await migrate_legacy_users()
    email = user.email.lower()
    existing_user = await db.users.find_one({"email": email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Questa email è già registrata. Accedi invece.")

    hashed_password = pwd_context.hash(user.master_password)
    user_doc = {
        "user_id": email,
        "email": email,
        "master_password": hashed_password,
        "created_at": datetime.utcnow(),
    }

    await db.users.insert_one(user_doc)
    return UserResponse(user_id=email, email=email, created_at=user_doc["created_at"])


@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    """Verify email + master password"""
    await authenticate_user(credentials.email, credentials.master_password)
    return {"success": True, "message": "Login successful"}


@api_router.get("/auth/check")
async def check_setup(email: Optional[str] = None):
    """Check if any account exists, or if a specific email is registered."""
    await migrate_legacy_users()
    if email:
        user = await db.users.find_one({"email": email.lower()})
        return {"is_setup": user is not None, "email": email.lower() if user else ""}
    user = await db.users.find_one()
    return {"is_setup": user is not None, "email": user.get("email", "") if user else ""}


@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Send OTP to registered email for password reset"""
    user = await get_user_by_email(request.email)
    if not user:
        raise HTTPException(status_code=404, detail="Nessun account con questa email")

    otp_code = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    email_sent = send_otp_email(request.email, otp_code)
    if not email_sent:
        raise HTTPException(
            status_code=500,
            detail="Impossibile inviare email. Verifica che l'indirizzo sia corretto o riprova più tardi.",
        )

    await db.otp_codes.delete_many({"email": request.email.lower()})
    await db.otp_codes.insert_one({
        "email": request.email.lower(),
        "otp_code": otp_code,
        "created_at": datetime.utcnow(),
        "expires_at": expires_at,
    })

    return {"success": True, "message": "Codice inviato via email"}


@api_router.post("/auth/verify-otp-reset")
async def verify_otp_reset(request: VerifyOTPResetRequest):
    """Verify OTP and reset master password for that email; entries preserved."""
    otp_record = await db.otp_codes.find_one({
        "email": request.email.lower(),
        "otp_code": request.otp_code,
    })

    if not otp_record:
        raise HTTPException(status_code=400, detail="Codice non valido")

    if datetime.utcnow() > otp_record["expires_at"]:
        await db.otp_codes.delete_one({"_id": otp_record["_id"]})
        raise HTTPException(status_code=400, detail="Codice scaduto")

    hashed_password = pwd_context.hash(request.new_master_password)
    result = await db.users.update_one(
        {"email": request.email.lower()},
        {"$set": {"master_password": hashed_password}},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    await db.otp_codes.delete_many({"email": request.email.lower()})
    return {"success": True, "message": "Password resettata con successo. Le password salvate sono state preservate."}


@api_router.delete("/auth/reset")
async def reset_all_data():
    """Dangerous: wipe ALL users and entries."""
    await db.users.delete_many({})
    await db.password_entries.delete_many({})
    await db.otp_codes.delete_many({})
    return {"success": True, "message": "All data has been reset"}


# ============ Password Entry Routes ============

@api_router.post("/passwords", response_model=PasswordEntryResponse)
async def create_password_entry(entry: PasswordEntryCreate):
    """Create a new password entry for the authenticated user"""
    user = await authenticate_user(entry.email, entry.master_password)
    email = user["email"].lower()

    encrypted_password = encrypt_password(entry.password, email)

    entry_doc = {
        "owner_email": email,
        "account_name": entry.account_name,
        "username": entry.username,
        "password": encrypted_password,
        "url": entry.url or "",
        "notes": entry.notes or "",
        "category": entry.category,
        "tags": entry.tags,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    result = await db.password_entries.insert_one(entry_doc)
    entry_doc["id"] = str(result.inserted_id)
    entry_doc["password"] = entry.password

    return PasswordEntryResponse(**entry_doc)


@api_router.get("/passwords", response_model=List[PasswordEntryResponse])
async def get_all_passwords(master_password: str, email: EmailStr):
    """Get all password entries for this user"""
    user = await authenticate_user(email, master_password)
    owner = user["email"].lower()

    entries = await db.password_entries.find({"owner_email": owner}).to_list(1000)
    result = []

    for entry in entries:
        try:
            decrypted_password = decrypt_password(entry["password"], owner)
            entry["id"] = str(entry["_id"])
            entry["password"] = decrypted_password
            result.append(PasswordEntryResponse(**entry))
        except Exception as e:
            logging.error(f"Error decrypting password: {e}")
            continue

    return result


@api_router.get("/passwords/{entry_id}", response_model=PasswordEntryResponse)
async def get_password_entry(entry_id: str, master_password: str, email: EmailStr):
    """Get a specific password entry"""
    user = await authenticate_user(email, master_password)
    owner = user["email"].lower()

    try:
        entry = await db.password_entries.find_one({"_id": ObjectId(entry_id), "owner_email": owner})
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid entry ID format")

    if not entry:
        raise HTTPException(status_code=404, detail="Password entry not found")

    decrypted_password = decrypt_password(entry["password"], owner)
    entry["id"] = str(entry["_id"])
    entry["password"] = decrypted_password

    return PasswordEntryResponse(**entry)


@api_router.put("/passwords/{entry_id}", response_model=PasswordEntryResponse)
async def update_password_entry(entry_id: str, update: PasswordEntryUpdate):
    """Update a password entry"""
    user = await authenticate_user(update.email, update.master_password)
    owner = user["email"].lower()

    try:
        entry = await db.password_entries.find_one({"_id": ObjectId(entry_id), "owner_email": owner})
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid entry ID format")

    if not entry:
        raise HTTPException(status_code=404, detail="Password entry not found")

    update_doc = {}
    if update.account_name is not None:
        update_doc["account_name"] = update.account_name
    if update.username is not None:
        update_doc["username"] = update.username
    if update.password is not None:
        update_doc["password"] = encrypt_password(update.password, owner)
    if update.url is not None:
        update_doc["url"] = update.url
    if update.notes is not None:
        update_doc["notes"] = update.notes
    if update.category is not None:
        update_doc["category"] = update.category
    if update.tags is not None:
        update_doc["tags"] = update.tags

    update_doc["updated_at"] = datetime.utcnow()

    await db.password_entries.update_one(
        {"_id": ObjectId(entry_id), "owner_email": owner},
        {"$set": update_doc},
    )

    updated_entry = await db.password_entries.find_one({"_id": ObjectId(entry_id)})
    decrypted_password = decrypt_password(updated_entry["password"], owner)
    updated_entry["id"] = str(updated_entry["_id"])
    updated_entry["password"] = decrypted_password

    return PasswordEntryResponse(**updated_entry)


@api_router.delete("/passwords/{entry_id}")
async def delete_password_entry(entry_id: str, master_password: str, email: EmailStr):
    """Delete a password entry"""
    user = await authenticate_user(email, master_password)
    owner = user["email"].lower()

    try:
        result = await db.password_entries.delete_one({"_id": ObjectId(entry_id), "owner_email": owner})
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid entry ID format")

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Password entry not found")

    return {"success": True, "message": "Password entry deleted"}


@api_router.post("/passwords/search", response_model=List[PasswordEntryResponse])
async def search_passwords(search: SearchRequest):
    """Search password entries by account name for this user"""
    user = await authenticate_user(search.email, search.master_password)
    owner = user["email"].lower()

    entries = await db.password_entries.find({
        "owner_email": owner,
        "account_name": {"$regex": search.query, "$options": "i"},
    }).to_list(1000)

    result = []
    for entry in entries:
        try:
            decrypted_password = decrypt_password(entry["password"], owner)
            entry["id"] = str(entry["_id"])
            entry["password"] = decrypted_password
            result.append(PasswordEntryResponse(**entry))
        except Exception as e:
            logging.error(f"Error decrypting password: {e}")
            continue

    return result


@api_router.get("/categories")
async def get_categories():
    """Get all available categories in Italian"""
    categories = [
        "Social Media",
        "Email",
        "Banca",
        "Acquisti",
        "Lavoro",
        "Intrattenimento",
        "Videogiochi",
        "Viaggi",
        "Istruzione",
        "Salute",
        "Altro",
    ]
    return {"categories": categories}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

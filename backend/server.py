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

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Resend setup
resend.api_key = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
SERVER_SECRET = os.environ.get('SERVER_SECRET', '')

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
    """Send OTP code via Resend"""
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
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============ Models ============

class UserCreate(BaseModel):
    email: EmailStr
    master_password: str

class UserLogin(BaseModel):
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

class PasswordEntryUpdate(BaseModel):
    account_name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    url: Optional[str] = None
    notes: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    master_password: str

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

# ============ Auth Routes ============

@api_router.post("/auth/setup", response_model=UserResponse)
async def setup_master_password(user: UserCreate):
    """Setup master password (first time) with email"""
    existing_user = await db.users.find_one()
    if existing_user:
        raise HTTPException(status_code=400, detail="Master password already set up")
    
    hashed_password = pwd_context.hash(user.master_password)
    user_doc = {
        "user_id": "master_user",
        "email": user.email,
        "master_password": hashed_password,
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user_doc)
    return UserResponse(user_id="master_user", email=user.email, created_at=user_doc["created_at"])

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    """Verify master password"""
    user = await db.users.find_one({"user_id": "master_user"})
    if not user:
        raise HTTPException(status_code=404, detail="Master password not set up")
    
    if not pwd_context.verify(credentials.master_password, user["master_password"]):
        raise HTTPException(status_code=401, detail="Invalid master password")
    
    return {"success": True, "message": "Login successful"}

@api_router.get("/auth/check")
async def check_setup():
    """Check if master password is already set up"""
    user = await db.users.find_one()
    return {"is_setup": user is not None, "email": user.get("email", "") if user else ""}

@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Send OTP to registered email for password reset"""
    user = await db.users.find_one({"user_id": "master_user"})
    if not user:
        raise HTTPException(status_code=404, detail="Nessun account registrato")
    
    if user.get("email", "").lower() != request.email.lower():
        raise HTTPException(status_code=404, detail="Email non corrisponde all'account registrato")
    
    # Generate OTP
    otp_code = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    # Send email FIRST - only save OTP if email was sent successfully
    email_sent = send_otp_email(request.email, otp_code)
    if not email_sent:
        raise HTTPException(
            status_code=500,
            detail="Impossibile inviare email. Verifica che l'indirizzo sia corretto o riprova più tardi."
        )
    
    # Remove old OTPs for this email
    await db.otp_codes.delete_many({"email": request.email.lower()})
    
    # Save new OTP
    await db.otp_codes.insert_one({
        "email": request.email.lower(),
        "otp_code": otp_code,
        "created_at": datetime.utcnow(),
        "expires_at": expires_at
    })
    
    return {"success": True, "message": "Codice inviato via email"}

@api_router.post("/auth/verify-otp-reset")
async def verify_otp_reset(request: VerifyOTPResetRequest):
    """Verify OTP code and reset master password.
    Password entries are PRESERVED because they're encrypted with email-derived key."""
    # Find OTP
    otp_record = await db.otp_codes.find_one({
        "email": request.email.lower(),
        "otp_code": request.otp_code
    })
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="Codice non valido")
    
    if datetime.utcnow() > otp_record["expires_at"]:
        await db.otp_codes.delete_one({"_id": otp_record["_id"]})
        raise HTTPException(status_code=400, detail="Codice scaduto")
    
    # Update ONLY the master password (keep entries intact)
    hashed_password = pwd_context.hash(request.new_master_password)
    result = await db.users.update_one(
        {"user_id": "master_user", "email": request.email.lower()},
        {"$set": {"master_password": hashed_password}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    
    # Clean up the used OTP
    await db.otp_codes.delete_many({"email": request.email.lower()})
    
    return {"success": True, "message": "Password resettata con successo. Le password salvate sono state preservate."}

@api_router.delete("/auth/reset")
async def reset_all_data():
    """Legacy reset endpoint - kept for backward compatibility"""
    await db.users.delete_many({})
    await db.password_entries.delete_many({})
    await db.otp_codes.delete_many({})
    return {"success": True, "message": "All data has been reset"}

# ============ Password Entry Routes ============

@api_router.post("/passwords", response_model=PasswordEntryResponse)
async def create_password_entry(entry: PasswordEntryCreate):
    """Create a new password entry"""
    user = await db.users.find_one({"user_id": "master_user"})
    if not user or not pwd_context.verify(entry.master_password, user["master_password"]):
        raise HTTPException(status_code=401, detail="Invalid master password")
    
    encrypted_password = encrypt_password(entry.password, user["email"])
    
    entry_doc = {
        "account_name": entry.account_name,
        "username": entry.username,
        "password": encrypted_password,
        "url": entry.url or "",
        "notes": entry.notes or "",
        "category": entry.category,
        "tags": entry.tags,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.password_entries.insert_one(entry_doc)
    entry_doc["id"] = str(result.inserted_id)
    entry_doc["password"] = entry.password
    
    return PasswordEntryResponse(**entry_doc)

@api_router.get("/passwords", response_model=List[PasswordEntryResponse])
async def get_all_passwords(master_password: str):
    """Get all password entries"""
    user = await db.users.find_one({"user_id": "master_user"})
    if not user or not pwd_context.verify(master_password, user["master_password"]):
        raise HTTPException(status_code=401, detail="Invalid master password")
    
    entries = await db.password_entries.find().to_list(1000)
    result = []
    
    for entry in entries:
        try:
            decrypted_password = decrypt_password(entry["password"], user["email"])
            entry["id"] = str(entry["_id"])
            entry["password"] = decrypted_password
            result.append(PasswordEntryResponse(**entry))
        except Exception as e:
            logging.error(f"Error decrypting password: {e}")
            continue
    
    return result

@api_router.get("/passwords/{entry_id}", response_model=PasswordEntryResponse)
async def get_password_entry(entry_id: str, master_password: str):
    """Get a specific password entry"""
    user = await db.users.find_one({"user_id": "master_user"})
    if not user or not pwd_context.verify(master_password, user["master_password"]):
        raise HTTPException(status_code=401, detail="Invalid master password")
    
    try:
        entry = await db.password_entries.find_one({"_id": ObjectId(entry_id)})
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid entry ID format")
    
    if not entry:
        raise HTTPException(status_code=404, detail="Password entry not found")
    
    decrypted_password = decrypt_password(entry["password"], user["email"])
    entry["id"] = str(entry["_id"])
    entry["password"] = decrypted_password
    
    return PasswordEntryResponse(**entry)

@api_router.put("/passwords/{entry_id}", response_model=PasswordEntryResponse)
async def update_password_entry(entry_id: str, update: PasswordEntryUpdate):
    """Update a password entry"""
    user = await db.users.find_one({"user_id": "master_user"})
    if not user or not pwd_context.verify(update.master_password, user["master_password"]):
        raise HTTPException(status_code=401, detail="Invalid master password")
    
    try:
        entry = await db.password_entries.find_one({"_id": ObjectId(entry_id)})
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
        update_doc["password"] = encrypt_password(update.password, user["email"])
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
        {"_id": ObjectId(entry_id)},
        {"$set": update_doc}
    )
    
    updated_entry = await db.password_entries.find_one({"_id": ObjectId(entry_id)})
    decrypted_password = decrypt_password(updated_entry["password"], user["email"])
    updated_entry["id"] = str(updated_entry["_id"])
    updated_entry["password"] = decrypted_password
    
    return PasswordEntryResponse(**updated_entry)

@api_router.delete("/passwords/{entry_id}")
async def delete_password_entry(entry_id: str, master_password: str):
    """Delete a password entry"""
    user = await db.users.find_one({"user_id": "master_user"})
    if not user or not pwd_context.verify(master_password, user["master_password"]):
        raise HTTPException(status_code=401, detail="Invalid master password")
    
    try:
        result = await db.password_entries.delete_one({"_id": ObjectId(entry_id)})
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid entry ID format")
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Password entry not found")
    
    return {"success": True, "message": "Password entry deleted"}

@api_router.post("/passwords/search", response_model=List[PasswordEntryResponse])
async def search_passwords(search: SearchRequest):
    """Search password entries by account name"""
    user = await db.users.find_one({"user_id": "master_user"})
    if not user or not pwd_context.verify(search.master_password, user["master_password"]):
        raise HTTPException(status_code=401, detail="Invalid master password")
    
    entries = await db.password_entries.find({
        "account_name": {"$regex": search.query, "$options": "i"}
    }).to_list(1000)
    
    result = []
    for entry in entries:
        try:
            decrypted_password = decrypt_password(entry["password"], user["email"])
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
        "Altro"
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

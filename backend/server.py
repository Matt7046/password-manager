from fastapi import FastAPI, APIRouter, HTTPException, status
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from passlib.context import CryptContext
from cryptography.fernet import Fernet
import base64
import hashlib

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Encryption setup - generate key from master password
def get_encryption_key(master_password: str) -> bytes:
    """Generate a consistent encryption key from master password"""
    key = hashlib.sha256(master_password.encode()).digest()
    return base64.urlsafe_b64encode(key)

def encrypt_password(password: str, master_password: str) -> str:
    """Encrypt a password using master password"""
    key = get_encryption_key(master_password)
    f = Fernet(key)
    return f.encrypt(password.encode()).decode()

def decrypt_password(encrypted_password: str, master_password: str) -> str:
    """Decrypt a password using master password"""
    key = get_encryption_key(master_password)
    f = Fernet(key)
    return f.decrypt(encrypted_password.encode()).decode()

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ============ Models ============

class UserCreate(BaseModel):
    master_password: str

class UserLogin(BaseModel):
    master_password: str

class UserResponse(BaseModel):
    user_id: str
    created_at: datetime

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
    password: str  # Will be decrypted when returned
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
    """Setup master password (first time)"""
    # Check if user already exists
    existing_user = await db.users.find_one()
    if existing_user:
        raise HTTPException(status_code=400, detail="Master password already set up")
    
    hashed_password = pwd_context.hash(user.master_password)
    user_doc = {
        "user_id": "master_user",
        "master_password": hashed_password,
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user_doc)
    return UserResponse(user_id="master_user", created_at=user_doc["created_at"])

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
    return {"is_setup": user is not None}

# ============ Password Entry Routes ============

@api_router.post("/passwords", response_model=PasswordEntryResponse)
async def create_password_entry(entry: PasswordEntryCreate):
    """Create a new password entry"""
    # Verify master password
    user = await db.users.find_one({"user_id": "master_user"})
    if not user or not pwd_context.verify(entry.master_password, user["master_password"]):
        raise HTTPException(status_code=401, detail="Invalid master password")
    
    # Encrypt the password
    encrypted_password = encrypt_password(entry.password, entry.master_password)
    
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
    entry_doc["password"] = entry.password  # Return decrypted
    
    return PasswordEntryResponse(**entry_doc)

@api_router.get("/passwords", response_model=List[PasswordEntryResponse])
async def get_all_passwords(master_password: str):
    """Get all password entries"""
    # Verify master password
    user = await db.users.find_one({"user_id": "master_user"})
    if not user or not pwd_context.verify(master_password, user["master_password"]):
        raise HTTPException(status_code=401, detail="Invalid master password")
    
    entries = await db.password_entries.find().to_list(1000)
    result = []
    
    for entry in entries:
        try:
            decrypted_password = decrypt_password(entry["password"], master_password)
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
    # Verify master password
    user = await db.users.find_one({"user_id": "master_user"})
    if not user or not pwd_context.verify(master_password, user["master_password"]):
        raise HTTPException(status_code=401, detail="Invalid master password")
    
    from bson import ObjectId
    entry = await db.password_entries.find_one({"_id": ObjectId(entry_id)})
    
    if not entry:
        raise HTTPException(status_code=404, detail="Password entry not found")
    
    decrypted_password = decrypt_password(entry["password"], master_password)
    entry["id"] = str(entry["_id"])
    entry["password"] = decrypted_password
    
    return PasswordEntryResponse(**entry)

@api_router.put("/passwords/{entry_id}", response_model=PasswordEntryResponse)
async def update_password_entry(entry_id: str, update: PasswordEntryUpdate):
    """Update a password entry"""
    # Verify master password
    user = await db.users.find_one({"user_id": "master_user"})
    if not user or not pwd_context.verify(update.master_password, user["master_password"]):
        raise HTTPException(status_code=401, detail="Invalid master password")
    
    from bson import ObjectId
    entry = await db.password_entries.find_one({"_id": ObjectId(entry_id)})
    
    if not entry:
        raise HTTPException(status_code=404, detail="Password entry not found")
    
    # Build update document
    update_doc = {}
    if update.account_name is not None:
        update_doc["account_name"] = update.account_name
    if update.username is not None:
        update_doc["username"] = update.username
    if update.password is not None:
        update_doc["password"] = encrypt_password(update.password, update.master_password)
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
    
    # Get updated entry
    updated_entry = await db.password_entries.find_one({"_id": ObjectId(entry_id)})
    decrypted_password = decrypt_password(updated_entry["password"], update.master_password)
    updated_entry["id"] = str(updated_entry["_id"])
    updated_entry["password"] = decrypted_password
    
    return PasswordEntryResponse(**updated_entry)

@api_router.delete("/passwords/{entry_id}")
async def delete_password_entry(entry_id: str, master_password: str):
    """Delete a password entry"""
    # Verify master password
    user = await db.users.find_one({"user_id": "master_user"})
    if not user or not pwd_context.verify(master_password, user["master_password"]):
        raise HTTPException(status_code=401, detail="Invalid master password")
    
    from bson import ObjectId
    result = await db.password_entries.delete_one({"_id": ObjectId(entry_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Password entry not found")
    
    return {"success": True, "message": "Password entry deleted"}

@api_router.post("/passwords/search", response_model=List[PasswordEntryResponse])
async def search_passwords(search: SearchRequest):
    """Search password entries by account name"""
    # Verify master password
    user = await db.users.find_one({"user_id": "master_user"})
    if not user or not pwd_context.verify(search.master_password, user["master_password"]):
        raise HTTPException(status_code=401, detail="Invalid master password")
    
    # Search by account name (case-insensitive)
    entries = await db.password_entries.find({
        "account_name": {"$regex": search.query, "$options": "i"}
    }).to_list(1000)
    
    result = []
    for entry in entries:
        try:
            decrypted_password = decrypt_password(entry["password"], search.master_password)
            entry["id"] = str(entry["_id"])
            entry["password"] = decrypted_password
            result.append(PasswordEntryResponse(**entry))
        except Exception as e:
            logging.error(f"Error decrypting password: {e}")
            continue
    
    return result

@api_router.get("/categories")
async def get_categories():
    """Get all available categories"""
    categories = [
        "Social Media",
        "Email",
        "Banking",
        "Shopping",
        "Work",
        "Entertainment",
        "Gaming",
        "Travel",
        "Education",
        "Health",
        "Other"
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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

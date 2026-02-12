from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel, Field, EmailStr
from bson import ObjectId
import os
import logging
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security settings
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-change-in-production-09876543210")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 * 24 * 60  # 30 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Create the main app
app = FastAPI(title="Finansal Yönetim API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ========================
# PYDANTIC MODELS
# ========================

class PyObjectId(str):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate
    
    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return str(v)

# User Models
class UserBase(BaseModel):
    email: EmailStr
    full_name: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    id: str = Field(alias="_id")
    created_at: datetime
    
    class Config:
        populate_by_name = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

# Category Models
class CategoryBase(BaseModel):
    name: str
    type: str  # "income" or "expense"
    color: str
    parent_id: Optional[str] = None
    order: int = 0

class CategoryCreate(CategoryBase):
    pass

class Category(CategoryBase):
    id: str = Field(alias="_id")
    user_id: str
    created_at: datetime
    
    class Config:
        populate_by_name = True

# Transaction Models
class TransactionBase(BaseModel):
    type: str  # "income" or "expense"
    amount: float
    category_id: str
    payment_method: str  # "cash", "bank", "credit_card"
    description: str
    date: datetime
    photo: Optional[str] = None  # base64 encoded image

class TransactionCreate(TransactionBase):
    pass

class Transaction(TransactionBase):
    id: str = Field(alias="_id")
    user_id: str
    created_at: datetime
    
    class Config:
        populate_by_name = True

# Current Account (Cari) Models
class CurrentAccountBase(BaseModel):
    name: str
    phone: Optional[str] = None
    type: str  # "customer" or "supplier"

class CurrentAccountCreate(CurrentAccountBase):
    pass

class CurrentAccount(CurrentAccountBase):
    id: str = Field(alias="_id")
    user_id: str
    balance: float = 0.0  # positive = alacak (receivable), negative = borc (payable)
    created_at: datetime
    
    class Config:
        populate_by_name = True

# Current Account Transaction Models
class CurrentAccountTransactionBase(BaseModel):
    current_account_id: str
    type: str  # "debt" (borç) or "credit" (alacak)
    amount: float
    description: str
    date: datetime

class CurrentAccountTransactionCreate(CurrentAccountTransactionBase):
    pass

class CurrentAccountTransaction(CurrentAccountTransactionBase):
    id: str = Field(alias="_id")
    user_id: str
    created_at: datetime
    
    class Config:
        populate_by_name = True

# Dashboard Models
class DashboardStats(BaseModel):
    total_income: float
    total_expense: float
    balance: float
    recent_transactions: List[Transaction]
    top_categories: List[dict]

# ========================
# HELPER FUNCTIONS
# ========================

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise credentials_exception
    
    user["_id"] = str(user["_id"])
    return User(**user)

# ========================
# AUTH ENDPOINTS
# ========================

@api_router.post("/auth/register", response_model=Token)
async def register(user: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_dict = {
        "email": user.email,
        "full_name": user.full_name,
        "password": get_password_hash(user.password),
        "created_at": datetime.utcnow()
    }
    
    result = await db.users.insert_one(user_dict)
    user_dict["_id"] = str(result.inserted_id)
    
    # Create token
    access_token = create_access_token(data={"sub": str(result.inserted_id)})
    
    user_response = User(**user_dict)
    return Token(access_token=access_token, token_type="bearer", user=user_response)

@api_router.post("/auth/login", response_model=Token)
async def login(user: UserLogin):
    # Find user
    db_user = await db.users.find_one({"email": user.email})
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    # Create token
    access_token = create_access_token(data={"sub": str(db_user["_id"])})
    
    db_user["_id"] = str(db_user["_id"])
    user_response = User(**db_user)
    return Token(access_token=access_token, token_type="bearer", user=user_response)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# ========================
# CATEGORY ENDPOINTS
# ========================

@api_router.post("/categories", response_model=Category)
async def create_category(category: CategoryCreate, current_user: User = Depends(get_current_user)):
    category_dict = category.dict()
    category_dict.update({
        "user_id": current_user.id,
        "created_at": datetime.utcnow()
    })
    
    result = await db.categories.insert_one(category_dict)
    category_dict["_id"] = str(result.inserted_id)
    
    return Category(**category_dict)

@api_router.get("/categories", response_model=List[Category])
async def get_categories(current_user: User = Depends(get_current_user)):
    categories = await db.categories.find({"user_id": current_user.id}).sort("order", 1).to_list(1000)
    for cat in categories:
        cat["_id"] = str(cat["_id"])
    return [Category(**cat) for cat in categories]

@api_router.put("/categories/{category_id}", response_model=Category)
async def update_category(category_id: str, category: CategoryCreate, current_user: User = Depends(get_current_user)):
    result = await db.categories.find_one_and_update(
        {"_id": ObjectId(category_id), "user_id": current_user.id},
        {"$set": category.dict()},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Category not found")
    
    result["_id"] = str(result["_id"])
    return Category(**result)

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, current_user: User = Depends(get_current_user)):
    result = await db.categories.delete_one({"_id": ObjectId(category_id), "user_id": current_user.id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return {"message": "Category deleted successfully"}

@api_router.post("/categories/reorder")
async def reorder_categories(categories: List[dict], current_user: User = Depends(get_current_user)):
    for cat in categories:
        await db.categories.update_one(
            {"_id": ObjectId(cat["id"]), "user_id": current_user.id},
            {"$set": {"order": cat["order"]}}
        )
    return {"message": "Categories reordered successfully"}

# ========================
# TRANSACTION ENDPOINTS
# ========================

@api_router.post("/transactions", response_model=Transaction)
async def create_transaction(transaction: TransactionCreate, current_user: User = Depends(get_current_user)):
    transaction_dict = transaction.dict()
    transaction_dict.update({
        "user_id": current_user.id,
        "created_at": datetime.utcnow()
    })
    
    result = await db.transactions.insert_one(transaction_dict)
    transaction_dict["_id"] = str(result.inserted_id)
    
    return Transaction(**transaction_dict)

@api_router.get("/transactions", response_model=List[Transaction])
async def get_transactions(
    skip: int = 0,
    limit: int = 100,
    type: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {"user_id": current_user.id}
    if type:
        query["type"] = type
    
    transactions = await db.transactions.find(query).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    for trans in transactions:
        trans["_id"] = str(trans["_id"])
    return [Transaction(**trans) for trans in transactions]

@api_router.get("/transactions/{transaction_id}", response_model=Transaction)
async def get_transaction(transaction_id: str, current_user: User = Depends(get_current_user)):
    transaction = await db.transactions.find_one({"_id": ObjectId(transaction_id), "user_id": current_user.id})
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    transaction["_id"] = str(transaction["_id"])
    return Transaction(**transaction)

@api_router.put("/transactions/{transaction_id}", response_model=Transaction)
async def update_transaction(transaction_id: str, transaction: TransactionCreate, current_user: User = Depends(get_current_user)):
    result = await db.transactions.find_one_and_update(
        {"_id": ObjectId(transaction_id), "user_id": current_user.id},
        {"$set": transaction.dict()},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    result["_id"] = str(result["_id"])
    return Transaction(**result)

@api_router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str, current_user: User = Depends(get_current_user)):
    result = await db.transactions.delete_one({"_id": ObjectId(transaction_id), "user_id": current_user.id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    return {"message": "Transaction deleted successfully"}

# ========================
# CURRENT ACCOUNT ENDPOINTS (CARİ HESAP)
# ========================

@api_router.post("/current-accounts", response_model=CurrentAccount)
async def create_current_account(account: CurrentAccountCreate, current_user: User = Depends(get_current_user)):
    account_dict = account.dict()
    account_dict.update({
        "user_id": current_user.id,
        "balance": 0.0,
        "created_at": datetime.utcnow()
    })
    
    result = await db.current_accounts.insert_one(account_dict)
    account_dict["_id"] = str(result.inserted_id)
    
    return CurrentAccount(**account_dict)

@api_router.get("/current-accounts", response_model=List[CurrentAccount])
async def get_current_accounts(current_user: User = Depends(get_current_user)):
    accounts = await db.current_accounts.find({"user_id": current_user.id}).to_list(1000)
    for acc in accounts:
        acc["_id"] = str(acc["_id"])
    return [CurrentAccount(**acc) for acc in accounts]

@api_router.get("/current-accounts/{account_id}", response_model=CurrentAccount)
async def get_current_account(account_id: str, current_user: User = Depends(get_current_user)):
    account = await db.current_accounts.find_one({"_id": ObjectId(account_id), "user_id": current_user.id})
    
    if not account:
        raise HTTPException(status_code=404, detail="Current account not found")
    
    account["_id"] = str(account["_id"])
    return CurrentAccount(**account)

@api_router.put("/current-accounts/{account_id}", response_model=CurrentAccount)
async def update_current_account(account_id: str, account: CurrentAccountCreate, current_user: User = Depends(get_current_user)):
    result = await db.current_accounts.find_one_and_update(
        {"_id": ObjectId(account_id), "user_id": current_user.id},
        {"$set": account.dict()},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Current account not found")
    
    result["_id"] = str(result["_id"])
    return CurrentAccount(**result)

@api_router.delete("/current-accounts/{account_id}")
async def delete_current_account(account_id: str, current_user: User = Depends(get_current_user)):
    # Delete account and all related transactions
    await db.current_account_transactions.delete_many({"current_account_id": account_id, "user_id": current_user.id})
    result = await db.current_accounts.delete_one({"_id": ObjectId(account_id), "user_id": current_user.id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Current account not found")
    
    return {"message": "Current account deleted successfully"}

# ========================
# CURRENT ACCOUNT TRANSACTION ENDPOINTS
# ========================

@api_router.post("/current-accounts/{account_id}/transactions", response_model=CurrentAccountTransaction)
async def create_current_account_transaction(
    account_id: str,
    transaction: CurrentAccountTransactionCreate,
    current_user: User = Depends(get_current_user)
):
    # Verify account exists and belongs to user
    account = await db.current_accounts.find_one({"_id": ObjectId(account_id), "user_id": current_user.id})
    if not account:
        raise HTTPException(status_code=404, detail="Current account not found")
    
    # Create transaction
    transaction_dict = transaction.dict()
    transaction_dict.update({
        "user_id": current_user.id,
        "created_at": datetime.utcnow()
    })
    
    result = await db.current_account_transactions.insert_one(transaction_dict)
    transaction_dict["_id"] = str(result.inserted_id)
    
    # Update account balance
    # credit (alacak) = positive, debt (borç) = negative
    balance_change = transaction.amount if transaction.type == "credit" else -transaction.amount
    await db.current_accounts.update_one(
        {"_id": ObjectId(account_id)},
        {"$inc": {"balance": balance_change}}
    )
    
    return CurrentAccountTransaction(**transaction_dict)

@api_router.get("/current-accounts/{account_id}/transactions", response_model=List[CurrentAccountTransaction])
async def get_current_account_transactions(
    account_id: str,
    current_user: User = Depends(get_current_user)
):
    transactions = await db.current_account_transactions.find(
        {"current_account_id": account_id, "user_id": current_user.id}
    ).sort("date", -1).to_list(1000)
    
    for trans in transactions:
        trans["_id"] = str(trans["_id"])
    return [CurrentAccountTransaction(**trans) for trans in transactions]

@api_router.delete("/current-accounts/{account_id}/transactions/{transaction_id}")
async def delete_current_account_transaction(
    account_id: str,
    transaction_id: str,
    current_user: User = Depends(get_current_user)
):
    # Get transaction first to calculate balance reversal
    transaction = await db.current_account_transactions.find_one({
        "_id": ObjectId(transaction_id),
        "current_account_id": account_id,
        "user_id": current_user.id
    })
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Delete transaction
    result = await db.current_account_transactions.delete_one({"_id": ObjectId(transaction_id)})
    
    # Reverse balance change
    balance_change = -transaction["amount"] if transaction["type"] == "credit" else transaction["amount"]
    await db.current_accounts.update_one(
        {"_id": ObjectId(account_id)},
        {"$inc": {"balance": balance_change}}
    )
    
    return {"message": "Transaction deleted successfully"}

# ========================
# DASHBOARD ENDPOINT
# ========================

@api_router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard(current_user: User = Depends(get_current_user)):
    # Get current month dates
    now = datetime.utcnow()
    start_of_month = datetime(now.year, now.month, 1)
    
    # Get all transactions for current month
    transactions = await db.transactions.find({
        "user_id": current_user.id,
        "date": {"$gte": start_of_month}
    }).to_list(10000)
    
    # Calculate totals
    total_income = sum(t["amount"] for t in transactions if t["type"] == "income")
    total_expense = sum(t["amount"] for t in transactions if t["type"] == "expense")
    balance = total_income - total_expense
    
    # Get recent 5 transactions
    recent = await db.transactions.find({"user_id": current_user.id}).sort("date", -1).limit(5).to_list(5)
    for trans in recent:
        trans["_id"] = str(trans["_id"])
    recent_transactions = [Transaction(**trans) for trans in recent]
    
    # Get top categories by expense
    pipeline = [
        {"$match": {"user_id": current_user.id, "type": "expense", "date": {"$gte": start_of_month}}},
        {"$group": {"_id": "$category_id", "total": {"$sum": "$amount"}}},
        {"$sort": {"total": -1}},
        {"$limit": 5}
    ]
    
    top_cats = await db.transactions.aggregate(pipeline).to_list(5)
    
    # Get category names
    top_categories = []
    for cat in top_cats:
        if cat["_id"]:
            category = await db.categories.find_one({"_id": ObjectId(cat["_id"])})
            if category:
                top_categories.append({
                    "category_name": category["name"],
                    "total": cat["total"]
                })
    
    return DashboardStats(
        total_income=total_income,
        total_expense=total_expense,
        balance=balance,
        recent_transactions=recent_transactions,
        top_categories=top_categories
    )

# ========================
# REPORTS ENDPOINT
# ========================

@api_router.get("/reports")
async def get_reports(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {"user_id": current_user.id}
    
    if start_date and end_date:
        query["date"] = {
            "$gte": datetime.fromisoformat(start_date),
            "$lte": datetime.fromisoformat(end_date)
        }
    
    transactions = await db.transactions.find(query).to_list(10000)
    
    # Calculate summary
    total_income = sum(t["amount"] for t in transactions if t["type"] == "income")
    total_expense = sum(t["amount"] for t in transactions if t["type"] == "expense")
    
    # Group by category
    category_breakdown = {}
    for trans in transactions:
        cat_id = trans.get("category_id")
        if cat_id:
            if cat_id not in category_breakdown:
                category = await db.categories.find_one({"_id": ObjectId(cat_id)})
                category_breakdown[cat_id] = {
                    "category_name": category["name"] if category else "Unknown",
                    "income": 0,
                    "expense": 0
                }
            
            if trans["type"] == "income":
                category_breakdown[cat_id]["income"] += trans["amount"]
            else:
                category_breakdown[cat_id]["expense"] += trans["amount"]
    
    return {
        "summary": {
            "total_income": total_income,
            "total_expense": total_expense,
            "balance": total_income - total_expense
        },
        "category_breakdown": list(category_breakdown.values()),
        "transaction_count": len(transactions)
    }

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

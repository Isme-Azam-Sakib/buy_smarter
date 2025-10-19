from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

# Database URL from environment variable
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///buysmarter.db")

# Fix file: URL format if present
if DATABASE_URL.startswith("file:"):
    DATABASE_URL = DATABASE_URL.replace("file:", "sqlite:///")

# Always use the correct database path
db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "buysmarter.db"))
DATABASE_URL = f"sqlite:///{db_path}"

print(f"Database URL: {DATABASE_URL}")

# Create SQLAlchemy engine
engine = create_engine(DATABASE_URL)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class
Base = declarative_base()

def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

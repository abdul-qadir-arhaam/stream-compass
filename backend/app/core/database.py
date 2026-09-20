from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

import os
from sqlalchemy.pool import NullPool

# Normalize PostgreSQL URL if provided as postgres:// (common in Supabase/Neon/Render)
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# In Vercel serverless environment, local relative paths are read-only.
# If PostgreSQL is not configured yet, fallback to /tmp for temporary SQLite storage.
is_vercel = os.environ.get("VERCEL") == "1" or os.environ.get("VERCEL_ENV") is not None
if is_vercel and db_url.startswith("sqlite:///."):
    db_url = "sqlite:////tmp/compass.db"

# Configure connect_args and engine parameters
connect_args = {}
engine_kwargs = {"pool_pre_ping": True}

if db_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False
else:
    # When deployed in serverless, use NullPool to prevent connection leakage across lambdas
    if is_vercel:
        engine_kwargs["poolclass"] = NullPool

engine = create_engine(
    db_url,
    connect_args=connect_args,
    **engine_kwargs,
)


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency for yielding database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

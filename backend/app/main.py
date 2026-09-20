from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
import app.models  # Ensure all models are registered
from app.services.seed_data import seed_database_if_empty


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables
    Base.metadata.create_all(bind=engine)
    
    # Run initial seeding if database is fresh
    db = SessionLocal()
    try:
        seed_database_if_empty(db)
    finally:
        db.close()
    
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Stream Compass - Intelligent Decision Engine for Movie & TV Discovery",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# CORS middleware
origins = [str(origin) for origin in settings.BACKEND_CORS_ORIGINS] if settings.BACKEND_CORS_ORIGINS else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
@app.get("/api")
@app.get(f"{settings.API_V1_STR}")
def root():
    return {
        "message": "Welcome to Stream Compass API",
        "status": "healthy",
        "docs": f"{settings.API_V1_STR}/docs",
        "version": settings.VERSION,
    }


from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.tmdb_sync import sync_tmdb_catalog
from app.services.tmdb_service import tmdb_service

router = APIRouter(prefix="/sync", tags=["sync"])


@router.get("/status")
def get_sync_status():
    """Return status of TMDB API configuration."""
    return {
        "tmdb_configured": tmdb_service.is_configured,
        "message": (
            "TMDB is configured and active."
            if tmdb_service.is_configured
            else "TMDB is not configured. Add TMDB_API_KEY to backend/.env to enable live sync."
        ),
    }


@router.post("/tmdb")
async def trigger_tmdb_sync(
    background_tasks: BackgroundTasks,
    pages: int = 2,
    db: Session = Depends(get_db),
):
    """Trigger TMDB catalog sync for Bollywood and OTT platforms."""
    if not tmdb_service.is_configured:
        return {
            "status": "unconfigured",
            "message": "TMDB_API_KEY is not set in backend/.env. Please add a valid key from themoviedb.org.",
        }

    result = await sync_tmdb_catalog(db=db, max_pages_per_category=pages)
    return result

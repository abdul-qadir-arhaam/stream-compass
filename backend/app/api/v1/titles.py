from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc

from app.core.database import get_db
from app.models.title import Title, Genre
from app.schemas.title import TitleSchema, TitleListResponse, TitleDetailSchema, GenreSchema

router = APIRouter()


@router.get("/genres", response_model=List[GenreSchema])
def get_genres(db: Session = Depends(get_db)):
    """Retrieve all available genres."""
    return db.query(Genre).order_by(Genre.name.asc()).all()


@router.get("/starter", response_model=List[TitleSchema])
def get_starter_titles(
    limit: int = Query(8, ge=1, le=20),
    db: Session = Depends(get_db)
):
    """Retrieve initial high-reputation titles for cold-start exploration and rating."""
    titles = db.query(Title).order_by(Title.vote_average.desc()).limit(limit).all()
    return titles


@router.get("/search", response_model=TitleListResponse)
def search_titles(
    q: Optional[str] = Query(None, description="Search keyword in title, overview, director, cast"),
    type: Optional[str] = Query(None, description="Filter by 'movie' or 'series'"),
    genre: Optional[str] = Query(None, description="Filter by genre name"),
    min_rating: Optional[float] = Query(None, ge=0.0, le=10.0, description="Minimum vote average"),
    sort_by: str = Query("popularity", description="Sort by 'popularity', 'rating', or 'newest'"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """Search titles with multi-field matching and filtering."""
    query = db.query(Title)

    # Keyword filter across multiple fields
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Title.title.ilike(term),
                Title.overview.ilike(term),
                Title.director.ilike(term),
                Title.cast_members.ilike(term),
            )
        )

    # Type filter
    if type and type.lower() in ("movie", "series"):
        query = query.filter(Title.type == type.lower())

    # Genre filter
    if genre and genre.strip():
        query = query.filter(Title.genres.any(Genre.name.ilike(f"%{genre.strip()}%")))

    # Minimum rating
    if min_rating is not None:
        query = query.filter(Title.vote_average >= min_rating)

    # Sorting
    if sort_by == "rating":
        query = query.order_by(desc(Title.vote_average))
    elif sort_by == "newest":
        query = query.order_by(desc(Title.release_date))
    else:
        query = query.order_by(desc(Title.popularity), desc(Title.vote_average))

    total = query.count()
    items = query.offset(skip).limit(limit).all()

    return {"total": total, "items": items}


@router.get("/{id}", response_model=TitleDetailSchema)
def get_title_details(
    id: int,
    db: Session = Depends(get_db)
):
    """Retrieve full details for a title, including dynamically computed similar titles."""
    title = db.query(Title).filter(Title.id == id).first()
    if not title:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Title with id {id} not found"
        )

    # Compute similar titles based on shared genres and type
    genre_ids = [g.id for g in title.genres]
    similar_titles: List[Title] = []
    
    if genre_ids:
        similar_titles = (
            db.query(Title)
            .filter(Title.id != title.id)
            .filter(Title.genres.any(Genre.id.in_(genre_ids)))
            .order_by(desc(Title.vote_average))
            .limit(4)
            .all()
        )

    from app.services.watch_providers import get_watch_options_for_title

    watch_opts = get_watch_options_for_title(title.title, title.ott_providers)
    title_data = TitleSchema.model_validate(title).model_dump()
    title_data["watch_options"] = watch_opts

    return {
        **title_data,
        "similar_titles": similar_titles
    }


@router.get("/", response_model=TitleListResponse)
def list_titles(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    type: Optional[str] = Query(None, description="movie or series"),
    db: Session = Depends(get_db)
):
    """List titles with pagination."""
    query = db.query(Title)
    if type:
        query = query.filter(Title.type == type)
    total = query.count()
    items = query.order_by(desc(Title.popularity)).offset(skip).limit(limit).all()
    return {"total": total, "items": items}

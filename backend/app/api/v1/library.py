from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.title import Title, Genre
from app.models.library import UserTitle, Watchlist
from app.schemas.library import (
    RateTitleRequest,
    ToggleWatchedRequest,
    ToggleWatchlistRequest,
    UserTitleResponse,
    WatchlistResponse,
    TitleInteractionStatusResponse,
    TasteProfileResponse,
    RecommendationItemResponse,
)
from app.schemas.title import TitleSchema
from app.services.recommender import recommender

router = APIRouter()


@router.post("/rate", response_model=UserTitleResponse)
def rate_title(
    payload: RateTitleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rate a movie or TV show (1.0 to 5.0 stars) and mark as watched."""
    title = db.query(Title).filter(Title.id == payload.title_id).first()
    if not title:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Title with id {payload.title_id} not found",
        )

    user_title = (
        db.query(UserTitle)
        .filter(
            UserTitle.user_id == current_user.id,
            UserTitle.title_id == payload.title_id,
        )
        .first()
    )

    if not user_title:
        user_title = UserTitle(
            user_id=current_user.id,
            title_id=payload.title_id,
            watched=payload.watched,
            rating=payload.rating,
            rating_reason=payload.rating_reason,
            review=payload.review,
        )
        db.add(user_title)
    else:
        user_title.watched = payload.watched
        user_title.rating = payload.rating
        if payload.rating_reason is not None:
            user_title.rating_reason = payload.rating_reason
        if payload.review is not None:
            user_title.review = payload.review

    db.commit()
    db.refresh(user_title)
    return user_title


@router.post("/watched", response_model=UserTitleResponse)
def toggle_watched(
    payload: ToggleWatchedRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a title as watched or unwatched."""
    title = db.query(Title).filter(Title.id == payload.title_id).first()
    if not title:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Title with id {payload.title_id} not found",
        )

    user_title = (
        db.query(UserTitle)
        .filter(
            UserTitle.user_id == current_user.id,
            UserTitle.title_id == payload.title_id,
        )
        .first()
    )

    if not user_title:
        user_title = UserTitle(
            user_id=current_user.id,
            title_id=payload.title_id,
            watched=payload.watched,
        )
        db.add(user_title)
    else:
        user_title.watched = payload.watched

    db.commit()
    db.refresh(user_title)
    return user_title


@router.get("/watched", response_model=List[UserTitleResponse])
def get_watched_titles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all titles marked as watched by the current user."""
    items = (
        db.query(UserTitle)
        .filter(UserTitle.user_id == current_user.id, UserTitle.watched == True)
        .order_by(desc(UserTitle.updated_at))
        .all()
    )
    return items


@router.delete("/watched/{title_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_watched_title(
    title_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a title from user's watched records."""
    user_title = (
        db.query(UserTitle)
        .filter(
            UserTitle.user_id == current_user.id,
            UserTitle.title_id == title_id,
        )
        .first()
    )
    if user_title:
        db.delete(user_title)
        db.commit()
    return None


@router.post("/watchlist", response_model=WatchlistResponse)
def toggle_watchlist(
    payload: ToggleWatchlistRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add or remove a title from user's watchlist."""
    title = db.query(Title).filter(Title.id == payload.title_id).first()
    if not title:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Title with id {payload.title_id} not found",
        )

    existing = (
        db.query(Watchlist)
        .filter(
            Watchlist.user_id == current_user.id,
            Watchlist.title_id == payload.title_id,
        )
        .first()
    )

    if existing:
        db.delete(existing)
        db.commit()
        return {
            "id": existing.id,
            "user_id": current_user.id,
            "title_id": payload.title_id,
            "notes": None,
            "created_at": existing.created_at,
            "title": title,
        }
    else:
        new_item = Watchlist(
            user_id=current_user.id,
            title_id=payload.title_id,
            notes=payload.notes,
        )
        db.add(new_item)
        db.commit()
        db.refresh(new_item)
        return new_item


@router.get("/watchlist", response_model=List[WatchlistResponse])
def get_watchlist(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve all titles on user's watchlist."""
    items = (
        db.query(Watchlist)
        .filter(Watchlist.user_id == current_user.id)
        .order_by(desc(Watchlist.created_at))
        .all()
    )
    return items


@router.get("/status/{title_id}", response_model=TitleInteractionStatusResponse)
def get_title_status(
    title_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the current user's interaction state with a title."""
    user_title = (
        db.query(UserTitle)
        .filter(
            UserTitle.user_id == current_user.id,
            UserTitle.title_id == title_id,
        )
        .first()
    )

    in_watchlist = (
        db.query(Watchlist)
        .filter(
            Watchlist.user_id == current_user.id,
            Watchlist.title_id == title_id,
        )
        .count()
        > 0
    )

    return {
        "title_id": title_id,
        "is_watched": bool(user_title and user_title.watched),
        "user_rating": user_title.rating if user_title else None,
        "rating_reason": user_title.rating_reason if user_title else None,
        "in_watchlist": in_watchlist,
    }


@router.get("/profile", response_model=TasteProfileResponse)
def get_taste_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Calculate taste profile metrics and favorite genres."""
    user_titles = (
        db.query(UserTitle)
        .filter(UserTitle.user_id == current_user.id)
        .all()
    )

    total_watched = sum(1 for ut in user_titles if ut.watched)
    rated_titles = [ut for ut in user_titles if ut.rating is not None]
    total_rated = len(rated_titles)
    average_rating = (
        round(sum(ut.rating for ut in rated_titles) / total_rated, 1)
        if total_rated > 0
        else 0.0
    )

    # Calculate genre frequencies among highly rated (>= 4 stars)
    genre_counts = {}
    for ut in rated_titles:
        if ut.rating and ut.rating >= 4.0 and ut.title:
            for genre in ut.title.genres:
                genre_counts[genre.name] = genre_counts.get(genre.name, 0) + 1

    favorite_genres = [
        {"genre": name, "count": count}
        for name, count in sorted(genre_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    ]

    top_rated_titles = [
        ut.title
        for ut in sorted(rated_titles, key=lambda x: x.rating or 0, reverse=True)[:5]
        if ut.title
    ]

    return {
        "total_watched": total_watched,
        "total_rated": total_rated,
        "average_rating": average_rating,
        "favorite_genres": favorite_genres,
        "top_rated_titles": top_rated_titles,
    }


@router.post("/watchlist/{title_id}/watched", response_model=UserTitleResponse)
def mark_watchlist_watched(
    title_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark an item on the watchlist as watched and remove it from watchlist."""
    title = db.query(Title).filter(Title.id == title_id).first()
    if not title:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Title with id {title_id} not found",
        )

    # 1. Remove from watchlist if present
    watchlist_item = (
        db.query(Watchlist)
        .filter(
            Watchlist.user_id == current_user.id,
            Watchlist.title_id == title_id,
        )
        .first()
    )
    if watchlist_item:
        db.delete(watchlist_item)

    # 2. Add or update user_title to watched = True
    user_title = (
        db.query(UserTitle)
        .filter(
            UserTitle.user_id == current_user.id,
            UserTitle.title_id == title_id,
        )
        .first()
    )
    if not user_title:
        user_title = UserTitle(
            user_id=current_user.id,
            title_id=title_id,
            watched=True,
        )
        db.add(user_title)
    else:
        user_title.watched = True

    db.commit()
    db.refresh(user_title)
    return user_title


@router.get("/recommendations", response_model=List[RecommendationItemResponse])
def get_recommendations(
    limit: int = Query(8, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve personalized content-based and taste-weighted recommendations with explainability."""
    results = recommender.get_recommendations(current_user, db, limit=limit, log_recs=True)
    return [
        {
            "title": r.title,
            "score": r.score,
            "explanation": r.explanation,
            "match_reasons": r.match_reasons,
        }
        for r in results
    ]


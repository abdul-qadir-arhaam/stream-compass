from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.title import TitleSchema


class RateTitleRequest(BaseModel):
    title_id: int
    rating: Optional[float] = Field(None, ge=1.0, le=5.0, description="1.0 to 5.0 stars")
    rating_reason: Optional[str] = Field(None, max_length=255)
    review: Optional[str] = None
    watched: bool = True


class ToggleWatchedRequest(BaseModel):
    title_id: int
    watched: bool = True


class ToggleWatchlistRequest(BaseModel):
    title_id: int
    notes: Optional[str] = Field(None, max_length=255)


class UserTitleResponse(BaseModel):
    id: int
    user_id: int
    title_id: int
    watched: bool
    rating: Optional[float] = None
    rating_reason: Optional[str] = None
    review: Optional[str] = None
    created_at: Optional[datetime] = None
    title: TitleSchema

    model_config = ConfigDict(from_attributes=True)


class WatchlistResponse(BaseModel):
    id: int
    user_id: int
    title_id: int
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    title: TitleSchema

    model_config = ConfigDict(from_attributes=True)


class TitleInteractionStatusResponse(BaseModel):
    title_id: int
    is_watched: bool
    user_rating: Optional[float] = None
    rating_reason: Optional[str] = None
    in_watchlist: bool


class TasteProfileResponse(BaseModel):
    total_watched: int
    total_rated: int
    average_rating: float
    favorite_genres: List[Dict[str, Any]]
    top_rated_titles: List[TitleSchema]


class RecommendationItemResponse(BaseModel):
    title: TitleSchema
    score: float
    explanation: str
    match_reasons: List[str] = []


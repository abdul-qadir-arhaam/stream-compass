from datetime import date
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class GenreSchema(BaseModel):
    id: int
    name: str
    model_config = ConfigDict(from_attributes=True)


class WatchOptionSchema(BaseModel):
    provider_key: str
    provider_name: str
    watch_url: str
    badge_bg: str
    badge_text: str
    badge_border: str
    button_bg: str
    button_text: str
    stream_type: str = "subscription"
    model_config = ConfigDict(from_attributes=True)


class TitleSchema(BaseModel):
    id: int
    tmdb_id: Optional[int] = None
    title: str
    original_title: Optional[str] = None
    type: str
    overview: Optional[str] = None
    release_date: Optional[date] = None
    runtime_minutes: Optional[int] = None
    vote_average: float
    vote_count: int
    popularity: float
    poster_path: Optional[str] = None
    backdrop_path: Optional[str] = None
    director: Optional[str] = None
    cast_members: Optional[str] = None
    keywords: Optional[str] = None
    ott_providers: Optional[str] = None
    genres: List[GenreSchema] = []
    watch_options: List[WatchOptionSchema] = []
    model_config = ConfigDict(from_attributes=True)


class TitleListResponse(BaseModel):
    total: int
    items: List[TitleSchema]


class TitleDetailSchema(TitleSchema):
    similar_titles: List[TitleSchema] = []

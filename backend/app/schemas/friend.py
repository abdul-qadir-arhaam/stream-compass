from typing import List, Optional, Dict
from pydantic import BaseModel, ConfigDict


class FriendSummarySchema(BaseModel):
    id: int
    username: str
    email: str
    taste_genres: List[str] = []
    total_watched: int = 0
    average_rating: float = 0.0
    model_config = ConfigDict(from_attributes=True)


class FriendUserSearchItem(BaseModel):
    id: int
    username: str
    email: str
    is_friend: bool = False
    relationship_status: str = "none"  # "none", "pending_sent", "pending_received", "friends"
    taste_genres: List[str] = []
    model_config = ConfigDict(from_attributes=True)


class FriendRequestItem(BaseModel):
    request_id: int
    user_id: int
    username: str
    email: str
    taste_genres: List[str] = []
    created_at: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class FriendRequestsListResponse(BaseModel):
    incoming: List[FriendRequestItem] = []
    outgoing: List[FriendRequestItem] = []



class FriendWatchedTitleItem(BaseModel):
    title_id: int
    title: str
    poster_path: Optional[str] = None
    vote_average: float
    rating: Optional[float] = None
    rating_reason: Optional[str] = None
    review: Optional[str] = None
    watched: bool = True
    model_config = ConfigDict(from_attributes=True)


class FriendGenreAffinity(BaseModel):
    genre: str
    count: int


class FriendProfileSchema(BaseModel):
    id: int
    username: str
    email: str
    total_watched: int
    total_rated: int
    average_rating: float
    favorite_genres: List[FriendGenreAffinity]
    recent_watched: List[FriendWatchedTitleItem]
    top_rated: List[FriendWatchedTitleItem]
    model_config = ConfigDict(from_attributes=True)


class FriendWatchStatusItem(BaseModel):
    friend_id: int
    friend_username: str
    rating: Optional[float] = None
    rating_reason: Optional[str] = None
    watched: bool = True
    model_config = ConfigDict(from_attributes=True)


class FriendsWatchedSummaryResponse(BaseModel):
    summary: Dict[int, List[FriendWatchStatusItem]]

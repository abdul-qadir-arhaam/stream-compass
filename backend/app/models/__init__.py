from app.core.database import Base
from app.models.user import User
from app.models.title import Title, Genre, title_genres
from app.models.library import UserTitle, Watchlist
from app.models.recommendation import UserPreferences, RecommendationLog
from app.models.friendship import Friendship

__all__ = [
    "Base",
    "User",
    "Title",
    "Genre",
    "title_genres",
    "UserTitle",
    "Watchlist",
    "UserPreferences",
    "RecommendationLog",
    "Friendship",
]


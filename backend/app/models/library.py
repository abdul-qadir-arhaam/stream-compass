from sqlalchemy import Column, Integer, String, Text, Float, Boolean, ForeignKey, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin


class UserTitle(Base, TimestampMixin):
    """Tracks titles a user has watched, rated (1-5 stars), and optional feedback/reasons."""
    __tablename__ = "user_titles"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title_id = Column(Integer, ForeignKey("titles.id", ondelete="CASCADE"), nullable=False, index=True)
    
    watched = Column(Boolean, default=True, nullable=False)
    rating = Column(Float, nullable=True)  # 1.0 to 5.0
    review = Column(Text, nullable=True)
    rating_reason = Column(String(255), nullable=True)  # e.g., "Great acting", "Amazing twist", "Boring pace"

    user = relationship("User", back_populates="watched_titles")
    title = relationship("Title", back_populates="user_interactions")

    __table_args__ = (
        UniqueConstraint("user_id", "title_id", name="uq_user_title"),
        Index("idx_user_titles_user_watched", "user_id", "watched"),
        Index("idx_user_titles_user_rating", "user_id", "rating"),
    )


class Watchlist(Base, TimestampMixin):
    """Titles saved by the user to watch in the future."""
    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title_id = Column(Integer, ForeignKey("titles.id", ondelete="CASCADE"), nullable=False, index=True)
    notes = Column(String(255), nullable=True)

    user = relationship("User", back_populates="watchlist_items")
    title = relationship("Title", back_populates="watchlist_items")

    __table_args__ = (
        UniqueConstraint("user_id", "title_id", name="uq_user_watchlist"),
    )

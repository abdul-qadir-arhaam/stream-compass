from sqlalchemy import Column, Integer, String, Text, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin


class UserPreferences(Base, TimestampMixin):
    """User-specific preferences, favorite genres, preferred runtime, and cold-start state."""
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    preferred_genres = Column(Text, nullable=True)  # JSON or comma-separated list of genre names
    max_runtime_minutes = Column(Integer, nullable=True)
    min_rating = Column(Float, default=6.0, nullable=False)
    novelty_preference = Column(String(50), default="balanced", nullable=False)  # "familiar", "balanced", "adventurous"

    user = relationship("User", back_populates="preferences")


class RecommendationLog(Base, TimestampMixin):
    """Log of recommendations served to users to evaluate feedback and algorithm iteration."""
    __tablename__ = "recommendation_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title_id = Column(Integer, ForeignKey("titles.id", ondelete="CASCADE"), nullable=False, index=True)
    
    tier = Column(String(50), nullable=False)  # "best_match", "safe_choice", "wildcard"
    score = Column(Float, nullable=False)
    explanation = Column(Text, nullable=True)  # "Why this?" reason
    algorithm_version = Column(String(50), default="v1_content", nullable=False)
    
    clicked = Column(Boolean, default=False, nullable=False)
    watched = Column(Boolean, default=False, nullable=False)
    feedback = Column(String(100), nullable=True)  # e.g., "too long", "too serious", "wrong genre"

    user = relationship("User", back_populates="recommendation_logs")
    title = relationship("Title")

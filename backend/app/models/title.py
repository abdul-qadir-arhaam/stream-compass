from sqlalchemy import Column, Integer, String, Text, Float, Date, ForeignKey, Table
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

title_genres = Table(
    "title_genres",
    Base.metadata,
    Column("title_id", Integer, ForeignKey("titles.id", ondelete="CASCADE"), primary_key=True),
    Column("genre_id", Integer, ForeignKey("genres.id", ondelete="CASCADE"), primary_key=True),
)


class Genre(Base):
    __tablename__ = "genres"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tmdb_genre_id = Column(Integer, unique=True, index=True, nullable=True)
    name = Column(String(100), unique=True, nullable=False)

    titles = relationship("Title", secondary=title_genres, back_populates="genres")


class Title(Base, TimestampMixin):
    __tablename__ = "titles"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tmdb_id = Column(Integer, unique=True, index=True, nullable=True)
    title = Column(String(255), nullable=False, index=True)
    original_title = Column(String(255), nullable=True)
    type = Column(String(20), default="movie", nullable=False)  # "movie" or "series"
    overview = Column(Text, nullable=True)
    release_date = Column(Date, nullable=True)
    runtime_minutes = Column(Integer, nullable=True)
    vote_average = Column(Float, default=0.0, nullable=False)
    vote_count = Column(Integer, default=0, nullable=False)
    popularity = Column(Float, default=0.0, nullable=False)
    poster_path = Column(String(255), nullable=True)
    backdrop_path = Column(String(255), nullable=True)
    director = Column(String(255), nullable=True)
    cast_members = Column(Text, nullable=True)  # Comma-separated or JSON list
    keywords = Column(Text, nullable=True)
    ott_providers = Column(String(255), nullable=True)  # e.g. "Netflix, Amazon Prime Video, Disney+ Hotstar"

    # Relationships
    genres = relationship("Genre", secondary=title_genres, back_populates="titles")
    user_interactions = relationship("UserTitle", back_populates="title", cascade="all, delete-orphan")
    watchlist_items = relationship("Watchlist", back_populates="title", cascade="all, delete-orphan")

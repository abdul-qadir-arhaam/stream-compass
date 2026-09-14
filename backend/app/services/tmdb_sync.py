import datetime
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.title import Title, Genre
from app.services.tmdb_service import tmdb_service, TMDB_IMAGE_BASE_URL, TMDB_BACKDROP_BASE_URL

logger = logging.getLogger(__name__)

# Standard TMDB genre ID to name mapping
TMDB_GENRE_MAP = {
    28: "Action",
    12: "Adventure",
    16: "Animation",
    35: "Comedy",
    80: "Crime",
    99: "Documentary",
    18: "Drama",
    10751: "Family",
    14: "Fantasy",
    36: "History",
    27: "Horror",
    10402: "Music",
    9648: "Mystery",
    10749: "Romance",
    878: "Sci-Fi",
    10770: "TV Movie",
    53: "Thriller",
    10752: "War",
    37: "Western",
    # TV genres
    10759: "Action",
    10762: "Family",
    10763: "News",
    10764: "Reality",
    10765: "Sci-Fi",
    10766: "Soap",
    10767: "Talk",
    10768: "War",
}


async def sync_tmdb_catalog(db: Session, max_pages_per_category: int = 2) -> Dict[str, Any]:
    """
    Ingest titles from TMDB across:
    1. Bollywood movies (Hindi, popular & top-rated)
    2. Bollywood TV series (Hindi)
    3. Netflix India popular titles
    4. Amazon Prime Video India popular titles
    5. Disney+ Hotstar India popular titles
    6. Global top-rated & trending hits
    """
    if not tmdb_service.is_configured:
        return {
            "status": "unconfigured",
            "message": "TMDB_API_KEY is not set. Please set TMDB_API_KEY in backend/.env to sync live titles from TMDB.",
            "synced_count": 0,
        }

    # Ensure all genres exist in DB
    genre_cache: Dict[str, Genre] = {g.name: g for g in db.query(Genre).all()}
    for g_name in set(TMDB_GENRE_MAP.values()):
        if g_name not in genre_cache:
            new_g = Genre(name=g_name)
            db.add(new_g)
            db.commit()
            genre_cache[g_name] = new_g

    synced_titles = 0
    updated_titles = 0

    # Define the discovery queries
    discovery_batches = [
        # Bollywood Movies
        {"media_type": "movie", "lang": "hi", "ott": None, "label": "Bollywood"},
        # Bollywood TV series
        {"media_type": "tv", "lang": "hi", "ott": None, "label": "Bollywood"},
        # Netflix titles
        {"media_type": "movie", "lang": None, "ott": "netflix", "label": "Netflix"},
        {"media_type": "tv", "lang": None, "ott": "netflix", "label": "Netflix"},
        # Prime Video titles
        {"media_type": "movie", "lang": None, "ott": "prime", "label": "Amazon Prime Video"},
        {"media_type": "tv", "lang": None, "ott": "prime", "label": "Amazon Prime Video"},
        # Disney+ Hotstar titles
        {"media_type": "movie", "lang": None, "ott": "hotstar", "label": "Disney+ Hotstar"},
        {"media_type": "tv", "lang": None, "ott": "hotstar", "label": "Disney+ Hotstar"},
    ]

    for batch in discovery_batches:
        media_type = batch["media_type"]
        lang = batch["lang"]
        ott = batch["ott"]
        ott_label = batch["label"]

        for page in range(1, max_pages_per_category + 1):
            results = await tmdb_service.discover_titles(
                media_type=media_type,
                original_language=lang,
                ott_platform=ott,
                page=page,
            )
            for item in results:
                tmdb_id = item.get("id")
                if not tmdb_id:
                    continue

                # Title name handling
                raw_title = item.get("title") or item.get("name") or "Untitled"
                orig_title = item.get("original_title") or item.get("original_name")
                overview = item.get("overview", "")
                vote_avg = float(item.get("vote_average", 0.0))
                vote_cnt = int(item.get("vote_count", 0))
                pop = float(item.get("popularity", 0.0))

                poster = item.get("poster_path")
                poster_url = f"{TMDB_IMAGE_BASE_URL}{poster}" if poster else None
                backdrop = item.get("backdrop_path")
                backdrop_url = f"{TMDB_BACKDROP_BASE_URL}{backdrop}" if backdrop else None

                # Release date
                date_str = item.get("release_date") or item.get("first_air_date")
                rel_date = None
                if date_str:
                    try:
                        rel_date = datetime.date.fromisoformat(date_str)
                    except Exception:
                        pass

                # Check if already exists by tmdb_id or title
                existing: Optional[Title] = db.query(Title).filter(
                    (Title.tmdb_id == tmdb_id) | (Title.title == raw_title)
                ).first()

                # Determine OTT provider string
                provider_list = []
                if ott_label and ott_label != "Bollywood":
                    provider_list.append(ott_label)

                # Keywords string
                orig_lang = item.get("original_language", "")
                kw_tags = []
                if orig_lang == "hi" or lang == "hi":
                    kw_tags.extend(["Bollywood", "Hindi Cinema", "Indian"])
                if ott_label:
                    kw_tags.append(ott_label)

                if existing:
                    # Update OTT providers if missing
                    current_providers = set([p.strip() for p in (existing.ott_providers or "").split(",") if p.strip()])
                    if ott_label and ott_label != "Bollywood":
                        current_providers.add(ott_label)
                    if current_providers:
                        existing.ott_providers = ", ".join(sorted(current_providers))
                    if not existing.tmdb_id:
                        existing.tmdb_id = tmdb_id
                    if poster_url and not existing.poster_path:
                        existing.poster_path = poster_url
                    if backdrop_url and not existing.backdrop_path:
                        existing.backdrop_path = backdrop_url
                    updated_titles += 1
                else:
                    new_title = Title(
                        tmdb_id=tmdb_id,
                        title=raw_title,
                        original_title=orig_title,
                        type="movie" if media_type == "movie" else "series",
                        overview=overview,
                        release_date=rel_date,
                        runtime_minutes=120 if media_type == "movie" else 45,
                        vote_average=vote_avg,
                        vote_count=vote_cnt,
                        popularity=pop,
                        poster_path=poster_url,
                        backdrop_path=backdrop_url,
                        director="Unknown",
                        cast_members="",
                        keywords=", ".join(kw_tags),
                        ott_providers=", ".join(provider_list) if provider_list else None,
                    )
                    # Attach genres
                    genre_ids = item.get("genre_ids", [])
                    for gid in genre_ids:
                        name = TMDB_GENRE_MAP.get(gid)
                        if name and name in genre_cache:
                            new_title.genres.append(genre_cache[name])

                    db.add(new_title)
                    synced_titles += 1

            db.commit()

    return {
        "status": "success",
        "synced_titles": synced_titles,
        "updated_titles": updated_titles,
        "total_catalog_size": db.query(Title).count(),
    }

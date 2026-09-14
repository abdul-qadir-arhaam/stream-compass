import os
import logging
from typing import Optional, Dict, Any, List
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

TMDB_API_BASE_URL = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"
TMDB_BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/original"

# Provider IDs in India (IN)
OTT_PROVIDER_IDS = {
    "netflix": 8,
    "prime": 119,
    "hotstar": 390,  # Disney+ Hotstar
}


class TMDBService:
    """Service to interact with The Movie Database (TMDB) API with fallback safety."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.TMDB_API_KEY or os.getenv("TMDB_API_KEY", "")

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    async def search(self, query: str, media_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search for movies and TV shows on TMDB."""
        if not self.is_configured or not query.strip():
            return []

        endpoint = f"{TMDB_API_BASE_URL}/search/multi"
        params = {
            "api_key": self.api_key,
            "query": query,
            "include_adult": False,
        }

        try:
            transport = httpx.AsyncHTTPTransport(retries=3)
            async with httpx.AsyncClient(timeout=12.0, transport=transport, headers={"User-Agent": "StreamCompass/1.0"}) as client:
                res = await client.get(endpoint, params=params)
                if res.status_code == 200:
                    data = res.json()
                    results = data.get("results", [])
                    if media_type:
                        results = [r for r in results if r.get("media_type") == media_type]
                    return results
                else:
                    logger.warning(f"TMDB search failed with status {res.status_code}")
                    return []
        except Exception as e:
            logger.warning(f"TMDB request failed: {e}")
            return []

    async def get_title_details(self, tmdb_id: int, media_type: str = "movie") -> Optional[Dict[str, Any]]:
        """Fetch full details and credits for a specific movie or TV show."""
        if not self.is_configured:
            return None

        endpoint = f"{TMDB_API_BASE_URL}/{media_type}/{tmdb_id}"
        params = {
            "api_key": self.api_key,
            "append_to_response": "credits,similar,keywords,watch/providers",
        }

        try:
            transport = httpx.AsyncHTTPTransport(retries=3)
            async with httpx.AsyncClient(timeout=12.0, transport=transport, headers={"User-Agent": "StreamCompass/1.0"}) as client:
                res = await client.get(endpoint, params=params)
                if res.status_code == 200:
                    return res.json()
                return None
        except Exception as e:
            logger.warning(f"TMDB get_title_details error: {e}")
            return None

    async def discover_titles(
        self,
        media_type: str = "movie",
        original_language: Optional[str] = None,
        ott_platform: Optional[str] = None,
        sort_by: str = "popularity.desc",
        page: int = 1,
    ) -> List[Dict[str, Any]]:
        """Discover movies or TV shows from TMDB by language and OTT streaming provider."""
        if not self.is_configured:
            return []

        endpoint = f"{TMDB_API_BASE_URL}/discover/{media_type}"
        params: Dict[str, Any] = {
            "api_key": self.api_key,
            "sort_by": sort_by,
            "page": page,
            "include_adult": False,
            "vote_count.gte": 15,
        }

        if original_language:
            params["with_original_language"] = original_language

        if ott_platform and ott_platform.lower() in OTT_PROVIDER_IDS:
            provider_id = OTT_PROVIDER_IDS[ott_platform.lower()]
            params["with_watch_providers"] = provider_id
            params["watch_region"] = "IN"

        try:
            transport = httpx.AsyncHTTPTransport(retries=3)
            async with httpx.AsyncClient(timeout=12.0, transport=transport, headers={"User-Agent": "StreamCompass/1.0"}) as client:
                res = await client.get(endpoint, params=params)
                if res.status_code == 200:
                    return res.json().get("results", [])
                logger.warning(f"TMDB discover failed with status {res.status_code}: {res.text}")
                return []
        except Exception as e:
            logger.warning(f"TMDB discover error: {e}")
            return []

    async def get_watch_providers(self, tmdb_id: int, media_type: str = "movie") -> List[str]:
        """Return list of streaming platform names for India (IN) and Global."""
        if not self.is_configured:
            return []

        endpoint = f"{TMDB_API_BASE_URL}/{media_type}/{tmdb_id}/watch/providers"
        params = {"api_key": self.api_key}

        try:
            transport = httpx.AsyncHTTPTransport(retries=3)
            async with httpx.AsyncClient(timeout=10.0, transport=transport, headers={"User-Agent": "StreamCompass/1.0"}) as client:
                res = await client.get(endpoint, params=params)
                if res.status_code == 200:
                    results = res.json().get("results", {})
                    in_region = results.get("IN", {})
                    flatrate = in_region.get("flatrate", [])
                    if not flatrate:
                        us_region = results.get("US", {})
                        flatrate = us_region.get("flatrate", [])
                    return [p.get("provider_name") for p in flatrate if p.get("provider_name")]
                return []
        except Exception as e:
            logger.warning(f"TMDB watch providers error: {e}")
            return []


tmdb_service = TMDBService()

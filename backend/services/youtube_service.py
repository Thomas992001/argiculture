"""
YouTube Video Search Service for the Digital Twin Greenhouse.

Searches YouTube Data API v3 for related agricultural/greenhouse videos.
Uses a simple API key for authentication (public data only).
"""

import time
import httpx
from typing import Dict, List, Optional, Tuple
from collections import OrderedDict

from backend.config import settings


# Language → YouTube search region & relevanceLanguage
LANGUAGE_CONFIG = {
    "zh": {"relevance_language": "zh-Hans", "region_code": "MY", "default_suffix": "温室 农业"},
    "en": {"relevance_language": "en", "region_code": "MY", "default_suffix": "greenhouse farming"},
    "ms": {"relevance_language": "ms", "region_code": "MY", "default_suffix": "rumah hijau pertanian"},
    "ta": {"relevance_language": "ta", "region_code": "MY", "default_suffix": "பசுமை இல்லம் விவசாயம்"},
}

YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
CACHE_TTL_SECONDS = 600  # 10 minutes
MAX_CACHE_SIZE = 100


class YouTubeService:
    """Searches YouTube for greenhouse/agriculture related videos using API Key."""

    def __init__(self):
        self._cache: OrderedDict[str, Tuple[float, List[dict]]] = OrderedDict()

    @property
    def is_available(self) -> bool:
        return bool(settings.youtube_api_key)

    def _get_cached(self, key: str) -> Optional[List[dict]]:
        if key in self._cache:
            ts, data = self._cache[key]
            if time.time() - ts < CACHE_TTL_SECONDS:
                self._cache.move_to_end(key)
                return data
            del self._cache[key]
        return None

    def _set_cache(self, key: str, data: List[dict]):
        self._cache[key] = (time.time(), data)
        while len(self._cache) > MAX_CACHE_SIZE:
            self._cache.popitem(last=False)

    async def search_videos(
        self,
        query: str,
        language: str = "en",
        max_results: int = 3,
    ) -> List[dict]:
        """
        Search YouTube for videos related to the query.

        Args:
            query: Search keywords (can be in any language)
            language: User's language code ("en", "zh", "ms", "ta")
            max_results: Number of videos to return (1-5)

        Returns:
            List of video dicts with: video_id, title, thumbnail, channel, url
        """
        if not self.is_available:
            print("[YouTubeService] No API key configured (YOUTUBE_API_KEY)")
            return []

        max_results = min(max(max_results, 1), 5)
        lang_cfg = LANGUAGE_CONFIG.get(language, LANGUAGE_CONFIG["en"])

        # Build cache key
        cache_key = f"{query}:{language}:{max_results}"
        cached = self._get_cached(cache_key)
        if cached is not None:
            return cached

        params = {
            "part": "snippet",
            "q": f"{query} {lang_cfg['default_suffix']}",
            "type": "video",
            "maxResults": max_results,
            "relevanceLanguage": lang_cfg["relevance_language"],
            "regionCode": lang_cfg["region_code"],
            "safeSearch": "moderate",
            "videoDuration": "medium",  # 4-20 minutes, good for tutorials
            "order": "relevance",
            "key": settings.youtube_api_key,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(YOUTUBE_SEARCH_URL, params=params)
                resp.raise_for_status()
                data = resp.json()

            videos = []
            for item in data.get("items", []):
                snippet = item.get("snippet", {})
                video_id = item.get("id", {}).get("videoId", "")
                if not video_id:
                    continue
                videos.append({
                    "video_id": video_id,
                    "title": snippet.get("title", ""),
                    "thumbnail": snippet.get("thumbnails", {}).get("medium", {}).get("url", ""),
                    "channel": snippet.get("channelTitle", ""),
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                    "published_at": snippet.get("publishedAt", ""),
                })

            self._set_cache(cache_key, videos)
            try:
                print(f"[YouTubeService] Found {len(videos)} videos for query (lang={language})")
            except Exception:
                pass
            return videos

        except httpx.HTTPStatusError as e:
            print(f"[YouTubeService] API error {e.response.status_code}: {e.response.text[:300]}")
            return []
        except Exception as e:
            print(f"[YouTubeService] Search error: {e}")
            return []


# Singleton
youtube_service = YouTubeService()

import urllib.parse
from typing import List, Dict, Any, Optional

PROVIDER_METADATA = {
    "netflix": {
        "name": "Netflix",
        "badge_bg": "rgba(229, 9, 20, 0.15)",
        "badge_text": "#ff4d4d",
        "badge_border": "rgba(229, 9, 20, 0.35)",
        "button_bg": "#e50914",
        "button_text": "#ffffff",
        "url_template": "https://www.netflix.com/search?q={query}",
    },
    "prime": {
        "name": "Amazon Prime Video",
        "badge_bg": "rgba(0, 168, 225, 0.15)",
        "badge_text": "#00a8e1",
        "badge_border": "rgba(0, 168, 225, 0.35)",
        "button_bg": "#00a8e1",
        "button_text": "#ffffff",
        "url_template": "https://www.primevideo.com/search/ref=atv_nb_sr?phrase={query}",
    },
    "hotstar": {
        "name": "Disney+ Hotstar",
        "badge_bg": "rgba(255, 179, 0, 0.15)",
        "badge_text": "#ffc107",
        "badge_border": "rgba(255, 179, 0, 0.35)",
        "button_bg": "#0f1b3e",
        "button_text": "#ffc107",
        "url_template": "https://www.hotstar.com/in/explore?search_query={query}",
    },
    "apple": {
        "name": "Apple TV+",
        "badge_bg": "rgba(255, 255, 255, 0.12)",
        "badge_text": "#ffffff",
        "badge_border": "rgba(255, 255, 255, 0.25)",
        "button_bg": "#222222",
        "button_text": "#ffffff",
        "url_template": "https://tv.apple.com/search?term={query}",
    },
    "jiocinema": {
        "name": "JioCinema",
        "badge_bg": "rgba(233, 30, 99, 0.15)",
        "badge_text": "#e91e63",
        "badge_border": "rgba(233, 30, 99, 0.35)",
        "button_bg": "#e91e63",
        "button_text": "#ffffff",
        "url_template": "https://www.jiocinema.com/search/{query}",
    },
}


def get_watch_options_for_title(title_name: str, ott_providers_str: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Generate structured, clickable deep watch options for a title based on known ott_providers.
    Falls back to prominent OTT platforms if ott_providers string is empty or unlisted.
    """
    encoded_query = urllib.parse.quote_plus(title_name.strip())
    providers_found = set()

    if ott_providers_str:
        tokens = [p.strip().lower() for p in ott_providers_str.split(",") if p.strip()]
        for token in tokens:
            if "netflix" in token:
                providers_found.add("netflix")
            elif "prime" in token or "amazon" in token:
                providers_found.add("prime")
            elif "hotstar" in token or "disney" in token:
                providers_found.add("hotstar")
            elif "apple" in token:
                providers_found.add("apple")
            elif "jio" in token:
                providers_found.add("jiocinema")

    # If no specific provider was matched, provide Google Play/Search or primary OTT direct search options
    if not providers_found:
        providers_found = {"netflix", "prime", "hotstar"}

    options = []
    # Order: netflix, prime, hotstar, jiocinema, apple
    order = ["netflix", "prime", "hotstar", "jiocinema", "apple"]
    for key in order:
        if key in providers_found and key in PROVIDER_METADATA:
            meta = PROVIDER_METADATA[key]
            options.append({
                "provider_key": key,
                "provider_name": meta["name"],
                "watch_url": meta["url_template"].format(query=encoded_query),
                "badge_bg": meta["badge_bg"],
                "badge_text": meta["badge_text"],
                "badge_border": meta["badge_border"],
                "button_bg": meta["button_bg"],
                "button_text": meta["button_text"],
                "stream_type": "subscription",
            })

    return options

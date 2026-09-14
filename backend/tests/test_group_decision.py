import pytest
from app.services.watch_providers import get_watch_options_for_title
from app.models.user import User
from app.models.title import Title, Genre
from app.models.library import UserTitle
from app.core.security import get_password_hash, create_access_token


def test_watch_provider_deep_links():
    """Verify deep links are generated for Netflix, Prime Video, and Hotstar."""
    options = get_watch_options_for_title("Inception", "Netflix, Amazon Prime Video, Disney+ Hotstar")
    provider_keys = [o["provider_key"] for o in options]
    
    assert "netflix" in provider_keys
    assert "prime" in provider_keys
    assert "hotstar" in provider_keys

    netflix_opt = next(o for o in options if o["provider_key"] == "netflix")
    assert "netflix.com/search?q=Inception" in netflix_opt["watch_url"]
    assert netflix_opt["badge_bg"] is not None

    prime_opt = next(o for o in options if o["provider_key"] == "prime")
    assert "primevideo.com/search" in prime_opt["watch_url"]
    assert "phrase=Inception" in prime_opt["watch_url"]

    hotstar_opt = next(o for o in options if o["provider_key"] == "hotstar")
    assert "hotstar.com" in hotstar_opt["watch_url"]
    assert "search_query=Inception" in hotstar_opt["watch_url"]


def get_auth(client, email: str, username: str):
    client.post(
        "/api/v1/auth/signup",
        json={"email": email, "username": username, "password": "pass12345password"},
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "pass12345password"},
    )
    data = login_res.json()
    return data["user"]["id"], {"Authorization": f"Bearer {data['access_token']}"}


def test_get_available_group_users(client):
    """Test retrieving other users for group mode selection."""
    u1_id, h1 = get_auth(client, "grouphost@example.com", "grouphost")
    u2_id, h2 = get_auth(client, "friend1@example.com", "friend1")
    u3_id, h3 = get_auth(client, "friend2@example.com", "friend2")

    res = client.get("/api/v1/decision/users", headers=h1)
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    user_ids = [u["id"] for u in data]
    assert u1_id not in user_ids
    assert u2_id in user_ids
    assert u3_id in user_ids


def test_group_decision_recommendations(client, db_session):
    """Test group recommendation triad generation and union-of-watched exclusions."""
    u1_id, h1 = get_auth(client, "alice_group@example.com", "alice_group")
    u2_id, h2 = get_auth(client, "bob_group@example.com", "bob_group")

    # Mark a title as watched for Alice
    watched_title = db_session.query(Title).first()
    assert watched_title is not None
    client.post(
        f"/api/v1/library/watched/{watched_title.id}",
        headers=h1,
    )

    payload = {
        "user_ids": [u2_id],
        "format": "either",
        "mood": "chill",
        "situation": "friends",
        "region": "all",
        "ott_platform": "all",
        "cycle_offset": 0,
    }

    res = client.post("/api/v1/decision/group", json=payload, headers=h1)
    assert res.status_code == 200
    data = res.json()

    assert data["consensus_pick"] is not None
    assert data["compromise_choice"] is not None
    assert data["group_wildcard"] is not None
    assert len(data["group_members"]) == 2

    # Verify watched title by Alice is NOT in any of the recommendations
    rec_ids = [
        data["consensus_pick"]["title"]["id"],
        data["compromise_choice"]["title"]["id"],
        data["group_wildcard"]["title"]["id"],
    ]
    assert watched_title.id not in rec_ids

    # Verify watch options exist on recommended titles
    assert "watch_options" in data["consensus_pick"]["title"]
    assert len(data["consensus_pick"]["title"]["watch_options"]) > 0


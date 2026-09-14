import pytest
from app.models.title import Title
from app.models.library import UserTitle


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


def test_friends_request_lifecycle(client):
    """Test sending a request, viewing incoming requests, and accepting."""
    u1_id, h1 = get_auth(client, "user_alpha@example.com", "useralpha")
    u2_id, h2 = get_auth(client, "user_beta@example.com", "userbeta")

    # 1. Search for beta from alpha
    search_res = client.get("/api/v1/friends/search?q=beta", headers=h1)
    assert search_res.status_code == 200
    search_data = search_res.json()
    beta_entry = next(u for u in search_data if u["id"] == u2_id)
    assert beta_entry["is_friend"] is False
    assert beta_entry["relationship_status"] == "none"

    # 2. Alpha sends friend request to beta
    req_res = client.post(f"/api/v1/friends/request/{u2_id}", headers=h1)
    assert req_res.status_code == 200
    assert req_res.json()["status"] == "pending_sent"

    # 3. Check search from Alpha -> relationship_status should be pending_sent
    search_again = client.get("/api/v1/friends/search?q=beta", headers=h1)
    beta_entry_2 = next(u for u in search_again.json() if u["id"] == u2_id)
    assert beta_entry_2["relationship_status"] == "pending_sent"

    # 4. Check requests from Beta's view -> incoming request from Alpha
    beta_reqs = client.get("/api/v1/friends/requests", headers=h2)
    assert beta_reqs.status_code == 200
    incoming = beta_reqs.json()["incoming"]
    assert len(incoming) == 1
    assert incoming[0]["user_id"] == u1_id
    req_id = incoming[0]["request_id"]

    # 5. Beta accepts Alpha's request
    accept_res = client.post(f"/api/v1/friends/requests/{req_id}/accept", headers=h2)
    assert accept_res.status_code == 200

    # 6. Verify in friends list of both users
    list_alpha = client.get("/api/v1/friends", headers=h1).json()
    assert any(f["id"] == u2_id for f in list_alpha)
    list_beta = client.get("/api/v1/friends", headers=h2).json()
    assert any(f["id"] == u1_id for f in list_beta)


def test_friends_decline_and_cancel_request(client):
    """Test declining and cancelling friend requests."""
    u1_id, h1 = get_auth(client, "user_decliner1@example.com", "decliner1")
    u2_id, h2 = get_auth(client, "user_decliner2@example.com", "decliner2")

    # Send request
    client.post(f"/api/v1/friends/request/{u2_id}", headers=h1)

    # User 2 declines
    beta_reqs = client.get("/api/v1/friends/requests", headers=h2).json()
    req_id = beta_reqs["incoming"][0]["request_id"]
    dec_res = client.post(f"/api/v1/friends/requests/{req_id}/decline", headers=h2)
    assert dec_res.status_code == 200

    # Verify not in incoming anymore
    beta_reqs_after = client.get("/api/v1/friends/requests", headers=h2).json()
    assert len(beta_reqs_after["incoming"]) == 0

    # User 1 sends another request, then cancels it
    client.post(f"/api/v1/friends/request/{u2_id}", headers=h1)
    alpha_reqs = client.get("/api/v1/friends/requests", headers=h1).json()
    out_id = alpha_reqs["outgoing"][0]["request_id"]
    cancel_res = client.delete(f"/api/v1/friends/requests/{out_id}/cancel", headers=h1)
    assert cancel_res.status_code == 200

    # Verify outgoing is empty
    alpha_reqs_after = client.get("/api/v1/friends/requests", headers=h1).json()
    assert len(alpha_reqs_after["outgoing"]) == 0


def test_friend_taste_profile_and_watched_summary(client, db_session):
    """Test inspecting a friend's Taste DNA and getting the watched summary map."""
    u1_id, h1 = get_auth(client, "friend_watcher@example.com", "fwatcher")
    u2_id, h2 = get_auth(client, "friend_rater@example.com", "frater")

    # Send and accept friend request
    client.post(f"/api/v1/friends/request/{u2_id}", headers=h1)
    reqs = client.get("/api/v1/friends/requests", headers=h2).json()
    req_id = reqs["incoming"][0]["request_id"]
    client.post(f"/api/v1/friends/requests/{req_id}/accept", headers=h2)

    # Have friend rate and watch a title with a reason
    title = db_session.query(Title).first()
    assert title is not None

    client.post(
        "/api/v1/library/rate",
        json={
            "title_id": title.id,
            "rating": 5.0,
            "rating_reason": "Brilliant Storytelling",
            "watched": True,
        },
        headers=h2,
    )

    # 1. Inspect friend's taste profile
    taste_res = client.get(f"/api/v1/friends/{u2_id}/taste", headers=h1)
    assert taste_res.status_code == 200
    taste_data = taste_res.json()
    assert taste_data["total_watched"] >= 1
    assert taste_data["total_rated"] >= 1
    assert any(item["title_id"] == title.id for item in taste_data["recent_watched"])
    watched_item = next(item for item in taste_data["recent_watched"] if item["title_id"] == title.id)
    assert watched_item["rating"] == 5.0
    assert watched_item["rating_reason"] == "Brilliant Storytelling"

    # 2. Get watched summary for all friends
    summary_res = client.get("/api/v1/friends/watched-summary", headers=h1)
    assert summary_res.status_code == 200
    summary = summary_res.json()["summary"]
    assert str(title.id) in summary
    assert len(summary[str(title.id)]) >= 1
    entry = summary[str(title.id)][0]
    assert entry["friend_id"] == u2_id
    assert entry["friend_username"] == "frater"
    assert entry["rating"] == 5.0


def test_remove_friend(client):
    """Test removing a friend connection."""
    u1_id, h1 = get_auth(client, "remover1@example.com", "remover1")
    u2_id, h2 = get_auth(client, "remover2@example.com", "remover2")

    # Add friend via request and accept
    client.post(f"/api/v1/friends/request/{u2_id}", headers=h1)
    reqs = client.get("/api/v1/friends/requests", headers=h2).json()
    req_id = reqs["incoming"][0]["request_id"]
    client.post(f"/api/v1/friends/requests/{req_id}/accept", headers=h2)

    # Remove friend
    del_res = client.delete(f"/api/v1/friends/{u2_id}", headers=h1)
    assert del_res.status_code == 204

    # Verify no longer in friends list
    list_res = client.get("/api/v1/friends", headers=h1)
    assert list_res.status_code == 200
    assert not any(f["id"] == u2_id for f in list_res.json())


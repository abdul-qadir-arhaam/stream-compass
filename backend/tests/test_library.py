import pytest


def get_authenticated_header(client, email="cinephile@example.com", username="cinephile"):
    client.post(
        "/api/v1/auth/signup",
        json={"email": email, "username": username, "password": "securepassword123"},
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "securepassword123"},
    )
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_rate_title_with_reason(client):
    headers = get_authenticated_header(client, "rater1@example.com", "rater1")

    # Get a title
    search_res = client.get("/api/v1/titles/search?limit=1")
    title_id = search_res.json()["items"][0]["id"]

    # Rate the title
    rate_payload = {
        "title_id": title_id,
        "rating": 5.0,
        "rating_reason": "Brilliant Storytelling",
        "review": "A cinematic masterpiece.",
        "watched": True,
    }
    response = client.post("/api/v1/library/rate", json=rate_payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["title_id"] == title_id
    assert data["rating"] == 5.0
    assert data["rating_reason"] == "Brilliant Storytelling"
    assert data["watched"] is True

    # Verify status
    status_res = client.get(f"/api/v1/library/status/{title_id}", headers=headers)
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["is_watched"] is True
    assert status_data["user_rating"] == 5.0
    assert status_data["rating_reason"] == "Brilliant Storytelling"


def test_watched_toggle_and_retrieval(client):
    headers = get_authenticated_header(client, "watcher2@example.com", "watcher2")
    titles = client.get("/api/v1/titles/search?limit=2").json()["items"]
    title1_id = titles[0]["id"]
    title2_id = titles[1]["id"]

    # Mark title1 as watched
    res1 = client.post("/api/v1/library/watched", json={"title_id": title1_id, "watched": True}, headers=headers)
    assert res1.status_code == 200
    assert res1.json()["watched"] is True

    # Mark title2 as watched
    res2 = client.post("/api/v1/library/watched", json={"title_id": title2_id, "watched": True}, headers=headers)
    assert res2.status_code == 200

    # Retrieve watched titles
    list_res = client.get("/api/v1/library/watched", headers=headers)
    assert list_res.status_code == 200
    watched_items = list_res.json()
    watched_ids = [item["title_id"] for item in watched_items]
    assert title1_id in watched_ids
    assert title2_id in watched_ids

    # Remove title1 from watched
    del_res = client.delete(f"/api/v1/library/watched/{title1_id}", headers=headers)
    assert del_res.status_code == 204

    # Verify list now only contains title2
    updated_res = client.get("/api/v1/library/watched", headers=headers)
    updated_ids = [item["title_id"] for item in updated_res.json()]
    assert title1_id not in updated_ids
    assert title2_id in updated_ids


def test_watchlist_workflow(client):
    headers = get_authenticated_header(client, "watchlist_user@example.com", "wluser")
    titles = client.get("/api/v1/titles/search?limit=2").json()["items"]
    title_id = titles[0]["id"]

    # Add to watchlist
    add_res = client.post(
        "/api/v1/library/watchlist",
        json={"title_id": title_id, "notes": "Must watch this weekend"},
        headers=headers,
    )
    assert add_res.status_code == 200
    assert add_res.json()["title_id"] == title_id
    assert add_res.json()["notes"] == "Must watch this weekend"

    # Check status
    status_res = client.get(f"/api/v1/library/status/{title_id}", headers=headers)
    assert status_res.json()["in_watchlist"] is True

    # Retrieve watchlist
    wl_res = client.get("/api/v1/library/watchlist", headers=headers)
    assert wl_res.status_code == 200
    assert any(item["title_id"] == title_id for item in wl_res.json())

    # Toggle off
    remove_res = client.post(
        "/api/v1/library/watchlist",
        json={"title_id": title_id},
        headers=headers,
    )
    assert remove_res.status_code == 200

    # Verify status in_watchlist is false
    status_res2 = client.get(f"/api/v1/library/status/{title_id}", headers=headers)
    assert status_res2.json()["in_watchlist"] is False


def test_mark_watchlist_item_as_watched(client):
    headers = get_authenticated_header(client, "wl_to_watched@example.com", "wltowatch")
    titles = client.get("/api/v1/titles/search?limit=1").json()["items"]
    title_id = titles[0]["id"]

    # Add to watchlist first
    client.post("/api/v1/library/watchlist", json={"title_id": title_id}, headers=headers)

    # Mark as watched via watchlist endpoint
    watched_res = client.post(f"/api/v1/library/watchlist/{title_id}/watched", headers=headers)
    assert watched_res.status_code == 200
    assert watched_res.json()["watched"] is True

    # Verify no longer in watchlist
    status_res = client.get(f"/api/v1/library/status/{title_id}", headers=headers)
    assert status_res.json()["in_watchlist"] is False
    assert status_res.json()["is_watched"] is True


def test_taste_profile_metrics(client):
    headers = get_authenticated_header(client, "profile_user@example.com", "profileuser")
    titles = client.get("/api/v1/titles/search?limit=3").json()["items"]

    # Rate 3 titles
    client.post(
        "/api/v1/library/rate",
        json={"title_id": titles[0]["id"], "rating": 5.0, "rating_reason": "Masterpiece"},
        headers=headers,
    )
    client.post(
        "/api/v1/library/rate",
        json={"title_id": titles[1]["id"], "rating": 4.0, "rating_reason": "Great acting"},
        headers=headers,
    )
    client.post(
        "/api/v1/library/rate",
        json={"title_id": titles[2]["id"], "rating": 3.0},
        headers=headers,
    )

    # Fetch taste profile
    profile_res = client.get("/api/v1/library/profile", headers=headers)
    assert profile_res.status_code == 200
    profile = profile_res.json()

    assert profile["total_watched"] == 3
    assert profile["total_rated"] == 3
    assert profile["average_rating"] == 4.0
    assert len(profile["favorite_genres"]) > 0
    assert len(profile["top_rated_titles"]) == 3


def test_recommendations_with_explainability_and_exclusion(client):
    headers = get_authenticated_header(client, "recs_user@example.com", "recsuser")

    # 1. Cold start recommendations before any ratings
    cold_recs = client.get("/api/v1/library/recommendations?limit=5", headers=headers)
    assert cold_recs.status_code == 200
    items = cold_recs.json()
    assert len(items) > 0
    assert "explanation" in items[0]
    assert len(items[0]["match_reasons"]) > 0

    # 2. Rate a Sci-Fi title with 5 stars
    scifi_titles = client.get("/api/v1/titles/search?genre=Sci-Fi").json()["items"]
    assert len(scifi_titles) >= 2
    rated_title = scifi_titles[0]

    client.post(
        "/api/v1/library/rate",
        json={"title_id": rated_title["id"], "rating": 5.0, "rating_reason": "Incredible visuals"},
        headers=headers,
    )

    # 3. Get recommendations again
    new_recs = client.get("/api/v1/library/recommendations?limit=10", headers=headers)
    assert new_recs.status_code == 200
    rec_items = new_recs.json()

    # The rated title MUST NOT be in recommendations (strictly excluded because it's watched)
    rec_ids = [item["title"]["id"] for item in rec_items]
    assert rated_title["id"] not in rec_ids

    # Unwatched Sci-Fi should have high score and explainability signal mentioning rating or genre
    assert any("Sci-Fi" in item["explanation"] or any("Sci-Fi" in r for r in item["match_reasons"]) for item in rec_items)

import pytest
from app.models.recommendation import RecommendationLog


def get_authenticated_header(client, email="decision_user@example.com", username="decider"):
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


def test_decision_default_triad(client):
    headers = get_authenticated_header(client, "triad@example.com", "triaduser")

    payload = {
        "format": "either",
        "novelty": "balanced",
    }
    response = client.post("/api/v1/decision/recommend", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()

    assert data["best_match"] is not None
    assert data["safe_choice"] is not None
    assert data["wildcard"] is not None

    assert data["best_match"]["tier"] == "best_match"
    assert data["safe_choice"]["tier"] == "safe_choice"
    assert data["wildcard"]["tier"] == "wildcard"

    # All three should be distinct titles
    id1 = data["best_match"]["title"]["id"]
    id2 = data["safe_choice"]["title"]["id"]
    id3 = data["wildcard"]["title"]["id"]
    assert len({id1, id2, id3}) == 3

    # Explanations should be non-empty and evidence based
    assert len(data["best_match"]["explanation"]) > 5
    assert len(data["safe_choice"]["explanation"]) > 5
    assert len(data["wildcard"]["explanation"]) > 5


def test_decision_runtime_constraint(client):
    headers = get_authenticated_header(client, "runtime@example.com", "runtimeuser")

    payload = {
        "format": "movie",
        "max_runtime": 100,  # Strict under 100 mins
    }
    response = client.post("/api/v1/decision/recommend", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()

    # If Best Match has runtime, it should be within or near the limit
    best_match = data["best_match"]
    assert best_match is not None
    if best_match["title"]["runtime_minutes"]:
        assert best_match["title"]["runtime_minutes"] <= 120  # penalized heavily if over


def test_decision_mood_and_format_filter(client):
    headers = get_authenticated_header(client, "mood@example.com", "mooduser")

    payload = {
        "format": "movie",
        "mood": "dark_suspense",
        "situation": "solo",
    }
    response = client.post("/api/v1/decision/recommend", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()

    assert data["best_match"]["title"]["type"] == "movie"
    assert "dark suspense" in data["context_summary"].lower()


def test_decision_feedback_rerank_workflow(client):
    headers = get_authenticated_header(client, "feedback@example.com", "feedbackuser")

    # Initial decision
    init_res = client.post("/api/v1/decision/recommend", json={"format": "either"}, headers=headers)
    assert init_res.status_code == 200
    init_data = init_res.json()

    rejected_id = init_data["best_match"]["title"]["id"]
    log_id = init_data["best_match"]["log_id"]

    # Reject with "too_long" feedback
    feedback_payload = {
        "log_id": log_id,
        "title_id": rejected_id,
        "feedback": "too_long",
        "context": {
            "format": "either",
            "rejected_title_ids": [rejected_id],
        },
    }

    rerank_res = client.post("/api/v1/decision/feedback", json=feedback_payload, headers=headers)
    assert rerank_res.status_code == 200
    rerank_data = rerank_res.json()

    # The rejected title must NOT be returned in any of the tiers
    new_ids = {
        rerank_data["best_match"]["title"]["id"],
        rerank_data["safe_choice"]["title"]["id"],
        rerank_data["wildcard"]["title"]["id"],
    }
    assert rejected_id not in new_ids


def test_decision_logs_persisted(client, db_session):
    headers = get_authenticated_header(client, "logcheck@example.com", "logchecker")

    res = client.post("/api/v1/decision/recommend", json={"mood": "mind_bending"}, headers=headers)
    assert res.status_code == 200

    logs = db_session.query(RecommendationLog).filter(RecommendationLog.algorithm_version == "v3_context").all()
    assert len(logs) >= 3
    tiers = {l.tier for l in logs}
    assert "best_match" in tiers
    assert "safe_choice" in tiers
    assert "wildcard" in tiers


def test_distinct_mood_results(client):
    headers = get_authenticated_header(client, "moodtest@example.com", "moodtester")

    # 1. Test "chill" mood
    chill_res = client.post("/api/v1/decision/recommend", json={"mood": "chill"}, headers=headers)
    assert chill_res.status_code == 200
    chill_data = chill_res.json()
    chill_best = chill_data["best_match"]
    chill_genres = {g["name"] for g in chill_best["title"]["genres"]}

    # Chill should match comedy, animation, adventure, or romance
    assert bool(chill_genres.intersection({"Comedy", "Animation", "Adventure", "Romance"}))

    # 2. Test "dark_suspense" mood
    dark_res = client.post("/api/v1/decision/recommend", json={"mood": "dark_suspense"}, headers=headers)
    assert dark_res.status_code == 200
    dark_data = dark_res.json()
    dark_best = dark_data["best_match"]
    dark_genres = {g["name"] for g in dark_best["title"]["genres"]}

    # Dark suspense should match thriller, crime, mystery, or horror
    assert bool(dark_genres.intersection({"Thriller", "Crime", "Mystery", "Horror"}))

    # The two moods MUST NOT produce the same best match
    assert chill_best["title"]["id"] != dark_best["title"]["id"]


def test_bollywood_region_filtering(client):
    headers = get_authenticated_header(client, "bollyuser@example.com", "bollytester")

    res = client.post(
        "/api/v1/decision/recommend",
        json={"region": "bollywood", "mood": "feel_good"},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()

    assert data["best_match"] is not None
    # Best match should have Bollywood/Hindi/Indian in keywords
    kw = data["best_match"]["title"]["keywords"] or ""
    assert "bollywood" in kw.lower() or "indian" in kw.lower() or "hindi" in kw.lower()


def test_ott_platform_filtering(client):
    headers = get_authenticated_header(client, "ottuser@example.com", "otttester")

    # 1. Netflix filter
    res = client.post(
        "/api/v1/decision/recommend",
        json={"ott_platform": "netflix"},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["best_match"] is not None
    ott = data["best_match"]["title"]["ott_providers"] or ""
    assert "netflix" in ott.lower()

    # 2. Prime filter
    prime_res = client.post(
        "/api/v1/decision/recommend",
        json={"ott_platform": "prime"},
        headers=headers,
    )
    assert prime_res.status_code == 200
    prime_data = prime_res.json()
    assert prime_data["best_match"] is not None
    prime_ott = prime_data["best_match"]["title"]["ott_providers"] or ""
    assert "prime" in prime_ott.lower()



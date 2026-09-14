import pytest
from app.models.user import User
from app.models.title import Title
from app.models.library import UserTitle
from app.services.collaborative import CollaborativeFilteringService, collaborative_service
from app.services.recommender import recommender
from app.schemas.decision import DecisionContextRequest


def test_cosine_and_centered_cosine_similarity():
    """Test raw cosine and mean-centered cosine similarity calculations."""
    vec_a = {1: 5.0, 2: 4.0, 3: 1.0}
    vec_b = {1: 5.0, 2: 4.0, 3: 1.0}  # Identical -> 1.0
    vec_c = {1: 1.0, 2: 1.0, 3: 5.0}  # Inverse -> negative or low

    sim_identical = CollaborativeFilteringService.calculate_cosine_similarity(vec_a, vec_b)
    assert round(sim_identical, 3) == 1.0

    sim_diff = CollaborativeFilteringService.calculate_centered_cosine(vec_a, vec_c)
    assert sim_diff < 0.0

    # No common items
    vec_d = {4: 5.0, 5: 4.0}
    sim_none = CollaborativeFilteringService.calculate_cosine_similarity(vec_a, vec_d)
    assert sim_none == 0.0


def test_user_nearest_neighbors(db_session):
    """Test finding nearest community peers based on shared ratings."""
    ratings = {
        1: {10: 5.0, 20: 5.0, 30: 4.0},
        2: {10: 5.0, 20: 4.5, 30: 4.0},  # Very similar to User 1
        3: {10: 1.0, 20: 1.0, 30: 2.0},  # Dislikes what User 1 likes
    }

    neighbors = CollaborativeFilteringService.find_nearest_neighbors(1, ratings, min_similarity=0.2)
    assert len(neighbors) >= 1
    top_peer_id, top_sim = neighbors[0]
    assert top_peer_id == 2
    assert top_sim > 0.8


def test_predict_collaborative_scores(db_session):
    """Test collaborative score prediction and explainability generation."""
    # Create test users
    u1 = User(email="cf_user1@test.com", username="cf_u1", hashed_password="pw")
    u2 = User(email="cf_user2@test.com", username="cf_u2", hashed_password="pw")
    db_session.add_all([u1, u2])
    db_session.commit()

    # Get two titles
    titles = db_session.query(Title).limit(3).all()
    assert len(titles) >= 2
    t1, t2 = titles[0], titles[1]

    # Both rate t1 highly (creates user similarity)
    db_session.add(UserTitle(user_id=u1.id, title_id=t1.id, rating=5.0, watched=True))
    db_session.add(UserTitle(user_id=u2.id, title_id=t1.id, rating=5.0, watched=True))

    # User 2 rated t2 5.0 (User 1 hasn't rated t2 yet)
    db_session.add(UserTitle(user_id=u2.id, title_id=t2.id, rating=5.0, watched=True))
    db_session.commit()

    # Predict collaborative score for t2 from User 1's perspective
    predictions = collaborative_service.predict_collaborative_scores(u1.id, [t2.id], db_session)
    assert t2.id in predictions
    pred_data = predictions[t2.id]

    assert pred_data["cf_score"] > 0.0
    assert pred_data["confidence"] > 0.0


def test_hybrid_decision_recommendation_flow(client, db_session):
    """Test end-to-end Decision Engine Triad integrating collaborative signals."""
    # Create user and rate a starter title
    signup_res = client.post(
        "/api/v1/auth/signup",
        json={"email": "hybrid_test@example.com", "username": "hybriduser", "password": "pass12345password"},
    )
    user_id = signup_res.json()["user"]["id"]
    token = signup_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    title = db_session.query(Title).first()
    assert title is not None

    # Rate title
    client.post(
        "/api/v1/library/rate",
        json={"title_id": title.id, "rating": 5.0, "watched": True},
        headers=headers,
    )

    # Request decision
    dec_res = client.post("/api/v1/decision/recommend", json={"mood": "chill"}, headers=headers)
    assert dec_res.status_code == 200
    dec_data = dec_res.json()

    assert dec_data["best_match"] is not None
    assert dec_data["safe_choice"] is not None
    assert dec_data["wildcard"] is not None
    assert dec_data["total_candidates"] > 0

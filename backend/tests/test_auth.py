def test_health_check(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_signup_success(client):
    payload = {
        "email": "alex@example.com",
        "username": "alexwatcher",
        "password": "strongpassword123"
    }
    response = client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "alex@example.com"
    assert data["user"]["username"] == "alexwatcher"


def test_signup_duplicate_email(client):
    payload = {
        "email": "duplicate@example.com",
        "username": "userone",
        "password": "password123"
    }
    res1 = client.post("/api/v1/auth/signup", json=payload)
    assert res1.status_code == 201

    payload2 = {
        "email": "duplicate@example.com",
        "username": "usertwo",
        "password": "password123"
    }
    res2 = client.post("/api/v1/auth/signup", json=payload2)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"]


def test_login_success(client):
    # Register user
    signup_payload = {
        "email": "loginuser@example.com",
        "username": "loginuser",
        "password": "mypassword123"
    }
    client.post("/api/v1/auth/signup", json=signup_payload)

    # Login
    login_payload = {
        "email": "loginuser@example.com",
        "password": "mypassword123"
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "loginuser@example.com"


def test_login_invalid_password(client):
    login_payload = {
        "email": "loginuser@example.com",
        "password": "wrongpassword"
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 401


def test_get_current_user_me(client):
    # Signup
    signup_payload = {
        "email": "metest@example.com",
        "username": "metest",
        "password": "password123"
    }
    res = client.post("/api/v1/auth/signup", json=signup_payload)
    token = res.json()["access_token"]

    # Call /me with bearer token
    headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "metest@example.com"

    # Call /me without token
    bad_res = client.get("/api/v1/auth/me")
    assert bad_res.status_code == 401

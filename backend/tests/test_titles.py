def test_starter_titles(client):
    response = client.get("/api/v1/titles/starter")
    assert response.status_code == 200
    items = response.json()
    assert len(items) > 0
    first = items[0]
    assert "title" in first
    assert "vote_average" in first
    assert "genres" in first
    assert "poster_path" in first


def test_list_titles_pagination(client):
    response = client.get("/api/v1/titles/?skip=0&limit=3")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "items" in data
    assert len(data["items"]) <= 3


def test_get_genres(client):
    response = client.get("/api/v1/titles/genres")
    assert response.status_code == 200
    genres = response.json()
    assert len(genres) > 0
    names = [g["name"] for g in genres]
    assert "Sci-Fi" in names


def test_search_titles_by_keyword(client):
    response = client.get("/api/v1/titles/search?q=Interstellar")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert any("Interstellar" in item["title"] for item in data["items"])


def test_search_titles_by_type_and_genre(client):
    response = client.get("/api/v1/titles/search?type=movie&genre=Sci-Fi")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    for item in data["items"]:
        assert item["type"] == "movie"
        genre_names = [g["name"] for g in item["genres"]]
        assert "Sci-Fi" in genre_names


def test_get_title_details_and_similar(client):
    # Fetch first title ID
    starter_res = client.get("/api/v1/titles/starter?limit=1")
    first_title = starter_res.json()[0]
    title_id = first_title["id"]

    response = client.get(f"/api/v1/titles/{title_id}")
    assert response.status_code == 200
    detail = response.json()
    assert detail["id"] == title_id
    assert detail["title"] == first_title["title"]
    assert "similar_titles" in detail
    assert isinstance(detail["similar_titles"], list)


def test_get_nonexistent_title_returns_404(client):
    response = client.get("/api/v1/titles/99999")
    assert response.status_code == 404

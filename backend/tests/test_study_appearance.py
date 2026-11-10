from test_access_control import client, login, seed_user


def test_appearance_is_account_and_app_scoped_without_revising_academic_state(client):
    web, db_factory = client
    endpoint = "/api/study-appearance"
    assert web.get(endpoint, headers={"X-Client-App": "cambridge"}).status_code == 401
    seed_user(db_factory, product_codes=("CAMBRIDGE", "ESO_ADULTOS", "DIPLOMATOR"))
    token = login(web).json()["access_token"]
    account = {"Authorization": f"Bearer {token}"}
    english = {**account, "X-Client-App": "cambridge"}
    eso = {**account, "X-Client-App": "eso_adultos"}
    assert web.post("/api/state", headers=account, json={"history": ["legacy"]}).status_code == 200
    academic = {"history": ["English"], "writingPractice": {"answer": "A draft"}}
    stored = web.post("/api/state", headers=english, json=academic)
    assert stored.status_code == 200
    eso_academic = {"done": {"topic": True}, "lessonNotes": {"topic": "Apuntes guardados"}}
    eso_stored = web.post("/api/state", headers=eso, json=eso_academic)
    assert eso_stored.status_code == 200

    assert web.get(endpoint, headers=english).json() == {"look": "route"}
    assert web.post(endpoint, headers=english, json={"look": "london"}).json() == {"look": "london"}
    assert web.get(endpoint, headers=eso).json() == {"look": "original"}
    assert web.post(endpoint, headers=eso, json={"look": "observatory"}).json() == {"look": "observatory"}
    assert web.post(endpoint, headers=eso, json={"look": "library"}).status_code == 422
    assert web.post(endpoint, headers=eso, json={"look": []}).status_code == 422
    assert web.get(endpoint, headers=account).status_code == 404
    assert web.get("/api/state", headers=account).json() == {"history": ["legacy"]}
    saved = web.get("/api/state", headers=english)
    assert saved.headers["etag"] == stored.headers["etag"]
    assert saved.json() == academic
    saved_eso = web.get("/api/state", headers=eso)
    assert saved_eso.headers["etag"] == eso_stored.headers["etag"]
    assert saved_eso.json() == eso_academic
    assert web.post("/api/state", headers={**english, "If-Match": stored.headers["etag"]}, json={**academic, "history": ["English", "Next"]}).status_code == 200
    assert web.get(endpoint, headers=english).json() == {"look": "london"}
    assert web.get(endpoint, headers=eso).json() == {"look": "observatory"}

    seed_user(db_factory, email="other@example.com", product_codes=("CAMBRIDGE", "DIPLOMATOR"))
    other_token = login(web, email="other@example.com").json()["access_token"]
    other = {"Authorization": f"Bearer {other_token}", "X-Client-App": "cambridge"}
    assert web.get(endpoint, headers=other).json() == {"look": "route"}
    assert web.post(endpoint, headers=other, json={"look": "route"}).json() == {"look": "route"}
    assert web.post(endpoint, headers=other, json={"look": "library"}).json() == {"look": "library"}
    assert web.get("/api/state", headers={"Authorization": f"Bearer {other_token}"}).json() == {}
    assert web.post(endpoint, headers=english, json={"look": "original"}).json() == {"look": "original"}
    assert web.get(endpoint, headers=english).json() == {"look": "original"}

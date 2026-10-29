"""ESO progress must never be silently overwritten by a stale tab."""

from test_access_control import client, login, seed_user


URL = "/api/state?app=eso_adultos"


def test_eso_state_requires_current_revision_and_preserves_newer_progress(client):
    web, factory = client
    seed_user(factory, product_codes=("ESO_ADULTOS",))
    assert login(web).status_code == 200

    initial = web.get(URL)
    assert initial.status_code == 200
    old_tag = initial.headers["etag"]
    assert initial.headers["cache-control"] == "private, no-store"

    first = web.post(URL, json={"done": {"tema-1": True}}, headers={"If-Match": old_tag})
    assert first.status_code == 200
    assert first.headers["etag"] != old_tag

    stale = web.post(URL, json={"done": {"tema-2": True}}, headers={"If-Match": old_tag})
    assert stale.status_code == 409
    assert stale.json()["detail"]["code"] == "state_conflict"

    outdated = web.post(URL, json={"done": {}})
    assert outdated.status_code == 428
    assert outdated.json()["detail"]["code"] == "state_version_required"
    assert web.get(URL).json()["done"] == {"tema-1": True}

    current = web.get(URL).headers["etag"]
    second = web.post(URL, json={"done": {"tema-1": True, "tema-2": True}}, headers={"If-Match": current})
    assert second.status_code == 200
    assert web.get(URL).json()["done"] == {"tema-1": True, "tema-2": True}

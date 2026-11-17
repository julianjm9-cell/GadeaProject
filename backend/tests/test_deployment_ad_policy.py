import json

import pytest

from app.api.profesor_ads import publication_policy
from app.deployment_check import verify_ad_policy


def test_deployment_accepts_the_current_api_policy():
    verify_ad_policy(json.dumps(publication_policy()).encode("utf-8"))


@pytest.mark.parametrize("changes", [
    {"version": "2026-10-09.3"},
    {"terms": "Condiciones antiguas"},
    {"publication": "Mi contacto se publicará"},
    {"automatic_expiry": True},
    {"automatic_deletion": True},
    {"automatic_expiry": 0},
    {"publication": None},
])
def test_deployment_rejects_stale_or_incomplete_policy(changes):
    policy = {**publication_policy(), **changes}
    with pytest.raises(AssertionError):
        verify_ad_policy(json.dumps(policy).encode("utf-8"))


@pytest.mark.parametrize("data", [b"<html>Login</html>", b"[]", b"null", b"{}"])
def test_deployment_rejects_non_policy_responses(data):
    with pytest.raises(AssertionError):
        verify_ad_policy(data)

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


@pytest.mark.parametrize('status,private,message,expected', [
    (401, True, 'Aplicación privada. Entra con una cuenta invitada.', True),
    (401, False, 'Aplicación privada. Entra con una cuenta invitada.', False),
    (503, True, 'Aplicación privada. Entra con una cuenta invitada.', False),
    (403, True, 'Fallo desconocido', False),
])
def test_deployment_only_accepts_declared_private_access(status, private, message, expected):
    from io import BytesIO
    from urllib.error import HTTPError
    from app.deployment_check import verify_expected_private
    error = HTTPError('https://example.invalid/cambridge-info', status, 'test', {'Cache-Control':'private, no-store'}, BytesIO(json.dumps({'detail':message}).encode()))
    assert verify_expected_private(error, '/cambridge-info', {'CAMBRIDGE':{'private':private}}) is expected

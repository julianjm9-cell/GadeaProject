import json
import pytest
from test_access_control import client
from app.services import release_status as release


@pytest.fixture
def release_files(tmp_path, monkeypatch):
    monkeypatch.setattr(release, 'BUILD_FILE', tmp_path / 'BUILD_REVISION')
    monkeypatch.setattr(release, 'RECEIPT_FILE', tmp_path / 'DEPLOYMENT_RECEIPT.json')
    return release.BUILD_FILE, release.RECEIPT_FILE


def test_running_image_is_separate_from_checkout_and_completed_deployment(release_files):
    build, receipt = release_files
    a, b = 'a' * 40, 'b' * 40
    assert release.release_status() == {'running_revision': None, 'verified_revision': None, 'verified_at': None}
    build.write_text(a)
    assert release.release_status()['verified_revision'] is None
    release.stamp(a)
    assert release.release_status()['verified_revision'] == a
    # Pulling another checkout does not replace a running Docker image.
    (build.parent / 'CHECKOUT_HEAD').write_text(b)
    assert release.release_status()['running_revision'] == a
    before = receipt.read_text()
    with pytest.raises(ValueError):
        release.stamp(b)
    assert receipt.read_text() == before
    build.write_text(b)
    assert release.release_status()['running_revision'] == b
    assert release.release_status()['verified_revision'] is None
    release.stamp(b)
    assert release.release_status()['verified_revision'] == b


@pytest.mark.parametrize('contents', ['incorrecto', '[]', '{"revision":"a"}', json.dumps({'revision':'a'*40, 'verified_at':'fecha inventada'}), json.dumps({'revision':'a'*40, 'verified_at':'2026-11-18T10:00:00'})])
def test_incomplete_receipts_never_confirm_a_deployment(release_files, contents):
    build, receipt = release_files
    build.write_text('a' * 40); receipt.write_text(contents)
    assert release.release_status()['verified_revision'] is None


def test_old_or_unidentified_images_do_not_inherit_a_successful_receipt(release_files):
    build, receipt = release_files
    receipt.write_text(json.dumps({'revision':'a'*40, 'verified_at':'2026-11-18T10:00:00Z'}))
    for value in ['', 'unknown', '../.env', 'a'*41]:
        build.write_text(value)
        assert release.release_status()['running_revision'] is None
        assert release.release_status()['verified_revision'] is None
    release.stamp('unknown')
    assert release.release_status()['verified_revision'] is None


def test_public_status_is_uncached_and_reports_no_secrets(client, release_files):
    web, _ = client
    build, _ = release_files; build.write_text('a' * 40); release.stamp('a' * 40)
    result = web.get('/api/public/release')
    assert result.status_code == 200
    assert result.headers['cache-control'] == 'no-store, max-age=0'
    assert result.json()['verified_revision'] == 'a' * 40
    assert set(result.json()) == {'running_revision', 'verified_revision', 'verified_at'}

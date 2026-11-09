from pathlib import Path
import shutil
from test_access_control import client


def test_studio_assets_are_shared_by_landing_and_app_and_packaged(client,tmp_path,monkeypatch):
    web,_=client
    from app.api import app_routes
    root=Path(__file__).parents[2]
    source=root/'apps/cambridge/assets/studio'
    files=list(source.glob('*.webp'))+[source/'studio.css',source/'landing.css',source/'landing-preview.js',source/'games.css',source/'journey.css',source/'games.js',source/'expansion.js']
    assert len(files)==29
    for path in files:
        response=web.get('/assets/cambridge-studio/'+path.name)
        assert response.status_code==200
        assert response.headers['content-type'].startswith('text/css' if path.suffix=='.css' else 'text/javascript' if path.suffix=='.js' else 'image/webp')
    shutil.copytree(source,tmp_path/'assets/cambridge-studio')
    monkeypatch.setattr(app_routes,'PROJECT_ROOT',tmp_path/'no-checkout')
    monkeypatch.setattr(app_routes,'STATIC_DIR',tmp_path)
    for path in files:
        response=web.get('/assets/cambridge-studio/'+path.name)
        assert response.status_code==200
    assert web.get('/assets/cambridge-studio/private.txt').status_code==404
    assert web.get('/assets/cambridge-studio/../private.txt').status_code==404


def test_special_game_assets_have_their_expected_mime_types(client):
    web, _ = client
    for name, mime in (
        ("game.css", "text/css"),
        ("game.js", "text/javascript"),
        ("archipelago-v1.webp", "image/webp"),
    ):
        response = web.get(f"/assets/lighthouse/{name}")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith(mime)
    assert web.get("/assets/lighthouse/private.txt").status_code == 404

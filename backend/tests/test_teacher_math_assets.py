from pathlib import Path
from test_access_control import client
from app.api import app_routes


def test_bundled_math_assets_in_docker(client, monkeypatch, tmp_path):
    web, _ = client
    source = Path(__file__).resolve().parents[2] / 'apps/profesor/assets/vendor/katex'
    target = tmp_path / 'assets/vendor/katex'
    (target / 'fonts').mkdir(parents=True)
    for filename in ['katex.min.js', 'katex.min.css', 'fonts/KaTeX_Main-Regular.woff2']:
        (target / filename).write_bytes((source / filename).read_bytes())
    monkeypatch.setattr(app_routes, 'PROJECT_ROOT', tmp_path / 'missing')
    monkeypatch.setattr(app_routes, 'STATIC_DIR', tmp_path)
    for filename in ['katex.min.js', 'katex.min.css', 'fonts/KaTeX_Main-Regular.woff2']:
        response = web.get('/assets/vendor/katex/' + filename)
        assert response.status_code == 200 and response.content
    assert web.get('/assets/vendor/katex/LICENSE').status_code == 404
    assert web.get('/assets/vendor/katex/fonts/missing.woff2').status_code == 404
    assert web.get('/assets/vendor/katex/%2E%2E/%2E%2E/secret.js').status_code == 404

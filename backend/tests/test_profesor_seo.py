from __future__ import annotations

from html.parser import HTMLParser

from test_access_control import client  # noqa: F401 - shared SQLite test fixture


PUBLIC_PAGES = (
    "/profesor",
    "/profesor/materiales-para-clases",
    "/profesor/juegos-interactivos",
    "/profesor/temario-clases",
    "/profesor/accesos-alumnos",
    "/profesor/anuncios",
    "/profesor/anunciar",
)


class PageMetadata(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self.description = ""
        self.canonical = ""
        self.headings: list[str] = []
        self.images: list[str] = []
        self._capture: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag == "title" or tag == "h1":
            self._capture = tag
        if tag == "meta" and attributes.get("name") == "description":
            self.description = attributes.get("content") or ""
        if tag == "link" and attributes.get("rel") == "canonical":
            self.canonical = attributes.get("href") or ""
        if tag == "img" and (attributes.get("src") or "").startswith("/assets/"):
            self.images.append(attributes["src"])

    def handle_endtag(self, tag: str) -> None:
        if self._capture == tag:
            self._capture = None

    def handle_data(self, data: str) -> None:
        if self._capture == "title":
            self.title += data
        elif self._capture == "h1":
            self.headings.append(data)


def test_public_profesor_pages_have_distinct_search_metadata(client):
    web, _ = client
    titles = set()
    descriptions = set()
    for path in PUBLIC_PAGES:
        response = web.get(path)
        assert response.status_code == 200, path
        assert "noindex" not in response.headers.get("x-robots-tag", ""), path
        page = PageMetadata()
        page.feed(response.text)
        assert page.title and page.description and page.headings, path
        assert page.canonical == "https://educame.tech" + path, path
        assert page.title not in titles and page.description not in descriptions, path
        assert all(old not in (page.title + page.description).lower() for old in ("educame tech", "educa suite", "edtech")), path
        titles.add(page.title)
        descriptions.add(page.description)
    sitemap = web.get("/sitemap.xml").text
    assert all("https://educame.tech" + path in sitemap for path in PUBLIC_PAGES)
    assert "/profesor/clases-de-apoyo" not in sitemap
    old_page = web.get("/profesor/clases-de-apoyo", follow_redirects=False)
    assert old_page.status_code == 308
    assert old_page.headers["location"] == "/profesor/accesos-alumnos"
    assert web.get("/profesor/demo").headers["x-robots-tag"] == "noindex, nofollow"


def test_profesor_explainer_images_exist(client):
    web, _ = client
    images = set()
    for path in PUBLIC_PAGES[1:5]:
        page = PageMetadata()
        page.feed(web.get(path).text)
        images.update(page.images)
    for image in images:
        response = web.get(image)
        assert response.status_code == 200, image
        assert response.headers["content-type"].startswith("image/"), image

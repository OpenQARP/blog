import io
import json
import urllib.error

import nbformat
import pytest

from scripts import fetch_posts
from scripts.fetch_posts import BundleError, fetch_notebook, main


def _nb_bytes():
    nb = nbformat.v4.new_notebook()
    nb.cells.append(nbformat.v4.new_markdown_cell("# Hi\n\n![f](figures/p/f.png)"))
    nb.cells.append(nbformat.v4.new_code_cell("print(1)"))
    return nbformat.writes(nb).encode()


def test_fetch_notebook_builds_raw_url_and_parses():
    seen = {}

    def opener(url, timeout=None):
        seen["url"] = url
        return io.BytesIO(_nb_bytes())

    nb = fetch_notebook("p", "v0.1.0", opener=opener)
    assert seen["url"] == "https://raw.githubusercontent.com/OpenQARP/openqarp/v0.1.0/examples/blog/p.ipynb"
    assert nb.cells[1].source == "print(1)"


def test_fetch_notebook_http_error():
    def opener(url, timeout=None):
        raise urllib.error.HTTPError(url, 404, "Not Found", {}, None)

    with pytest.raises(BundleError, match="p@v0.1.0: HTTP 404"):
        fetch_notebook("p", "v0.1.0", opener=opener)


def test_fetch_notebook_invalid_json():
    def opener(url, timeout=None):
        return io.BytesIO(b"{not json")

    with pytest.raises(BundleError, match="p@v0.1.0: not a notebook"):
        fetch_notebook("p", "v0.1.0", opener=opener)


def test_fetch_notebook_read_timeout():
    class Resp:
        def __enter__(self):
            return self
        def __exit__(self, *a):
            return False
        def read(self):
            raise TimeoutError("timed out")

    with pytest.raises(BundleError, match="p@v0.1.0: cannot fetch"):
        fetch_notebook("p", "v0.1.0", opener=lambda url, timeout=None: Resp())


def test_main_end_to_end(tmp_path, monkeypatch):
    monkeypatch.setattr(fetch_posts, "fetch_notebook", lambda slug, ref, opener=None: nbformat.reads(_nb_bytes().decode(), 4))
    (tmp_path / "posts.yaml").write_text("- slug: p\n  ref: v0.1.0\n  date: 2026-09-20\n  title: T\n  summary: S\n")
    (tmp_path / "figures" / "p").mkdir(parents=True)
    (tmp_path / "figures" / "p" / "f.png").write_bytes(b"png")
    (tmp_path / "content").mkdir()
    rc = main(["--manifest", str(tmp_path / "posts.yaml"), "--figures", str(tmp_path / "figures"),
               "--content", str(tmp_path / "content"), "--out", str(tmp_path / "out")])
    assert rc == 0
    md = (tmp_path / "out" / "posts" / "p" / "index.md").read_text()
    assert "![f](f.png)" in md and "```python\nprint(1)\n```" in md
    assert (tmp_path / "out" / "posts" / "p" / "f.png").exists()


def test_main_empty_manifest_creates_out_dir(tmp_path):
    (tmp_path / "posts.yaml").write_text("[]\n")
    rc = main(["--manifest", str(tmp_path / "posts.yaml"), "--figures", str(tmp_path / "figures"),
               "--content", str(tmp_path / "content"), "--out", str(tmp_path / "out")])
    assert rc == 0 and (tmp_path / "out" / "posts").is_dir()


def test_main_reports_errors(tmp_path, capsys):
    (tmp_path / "posts.yaml").write_text("- slug: p\n")
    rc = main(["--manifest", str(tmp_path / "posts.yaml"), "--figures", str(tmp_path / "figures"),
               "--content", str(tmp_path / "content"), "--out", str(tmp_path / "out")])
    assert rc == 1 and "p: missing" in capsys.readouterr().err


def test_main_removes_stale_bundles(tmp_path):
    stale = tmp_path / "out" / "posts" / "stale"
    stale.mkdir(parents=True)
    (stale / "index.md").write_text("stale\n")
    (tmp_path / "posts.yaml").write_text("[]\n")
    rc = main(["--manifest", str(tmp_path / "posts.yaml"), "--figures", str(tmp_path / "figures"),
               "--content", str(tmp_path / "content"), "--out", str(tmp_path / "out")])
    assert rc == 0
    assert not stale.exists()

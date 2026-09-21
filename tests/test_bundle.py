import dataclasses
import datetime
from pathlib import Path

import pytest

from scripts.fetch_posts import BundleError, Post, check_no_shadow, front_matter, write_bundle

POST = Post(slug="p", ref="v0.1.0", date=datetime.date(2026, 9, 20), title='Say "hi"', summary="s", tags=("a",))


def test_front_matter_is_yaml_with_pin():
    fm = front_matter(POST)
    assert fm.startswith("---\n") and fm.endswith("---\n")
    assert "title: Say \"hi\"" in fm
    assert "date: 2026-09-20" in fm
    assert "notebook_ref: v0.1.0" in fm
    assert "notebook_url: https://github.com/OpenQARP/openqarp/blob/v0.1.0/examples/blog/p.ipynb" in fm
    assert "math: false" in fm
    assert "- a" in fm


def test_write_bundle_copies_images(tmp_path):
    figs = tmp_path / "figures" / "p"
    figs.mkdir(parents=True)
    (figs / "a.png").write_bytes(b"png")
    out = tmp_path / "out"
    bundle = write_bundle(POST, "body\n", ["a.png"], tmp_path / "figures", out)
    assert bundle == out / "posts" / "p"
    assert (bundle / "a.png").read_bytes() == b"png"
    text = (bundle / "index.md").read_text()
    assert text.startswith("---\n") and text.endswith("---\nbody\n")


def test_write_bundle_missing_image(tmp_path):
    (tmp_path / "figures" / "p").mkdir(parents=True)
    with pytest.raises(BundleError, match="p: missing figure b.png"):
        write_bundle(POST, "body\n", ["b.png"], tmp_path / "figures", tmp_path / "out")


def test_write_bundle_no_figures_dir_is_fine_without_images(tmp_path):
    write_bundle(POST, "body\n", [], tmp_path / "figures", tmp_path / "out")


def test_write_bundle_warns_on_unreferenced(tmp_path, capsys):
    figs = tmp_path / "figures" / "p"
    figs.mkdir(parents=True)
    (figs / "stray.png").write_bytes(b"")
    write_bundle(POST, "body\n", [], tmp_path / "figures", tmp_path / "out")
    assert "p: unreferenced figure stray.png" in capsys.readouterr().err


def test_check_no_shadow(tmp_path):
    (tmp_path / "posts" / "p").mkdir(parents=True)
    with pytest.raises(BundleError, match="p: exists in both"):
        check_no_shadow([POST], tmp_path)
    check_no_shadow([POST], tmp_path / "elsewhere")


@pytest.mark.parametrize("name", ["sub/a.png", "../a.png"])
def test_write_bundle_rejects_nested_names(tmp_path, name):
    (tmp_path / "figures" / "p").mkdir(parents=True)
    with pytest.raises(BundleError, match="must be a plain file name"):
        write_bundle(POST, "body\n", [name], tmp_path / "figures", tmp_path / "out")


def test_front_matter_math_true():
    fm = front_matter(dataclasses.replace(POST, math=True))
    assert "math: true" in fm


def test_cover_in_front_matter_and_copied(tmp_path):
    figs = tmp_path / "figures" / "p"
    figs.mkdir(parents=True)
    (figs / "hero.png").write_bytes(b"png")
    post = dataclasses.replace(POST, cover="hero.png")
    assert "cover: hero.png" in front_matter(post)
    bundle = write_bundle(post, "body\n", [], tmp_path / "figures", tmp_path / "out")
    assert (bundle / "hero.png").read_bytes() == b"png"


def test_front_matter_has_no_cover_key_by_default():
    assert "cover" not in front_matter(POST)

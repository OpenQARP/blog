import datetime

import pytest

from scripts.fetch_posts import ManifestError, Post, load_manifest

GOOD = """
- slug: hello-blog
  ref: v0.1.0
  date: 2026-09-20
  title: "Hello"
  summary: "First post."
  tags: [vqe, engines]
- slug: second
  ref: abc123
  date: 2026-09-21
  title: "Second"
  summary: "Bare minimum."
"""


def test_loads_posts(tmp_path):
    p = tmp_path / "posts.yaml"
    p.write_text(GOOD)
    posts = load_manifest(p)
    assert posts[0] == Post(
        slug="hello-blog", ref="v0.1.0", date=datetime.date(2026, 9, 20),
        title="Hello", summary="First post.", tags=("vqe", "engines"),
    )
    assert posts[1].tags == () and posts[1].math is False


def test_empty_manifest(tmp_path):
    p = tmp_path / "posts.yaml"
    p.write_text("[]\n")
    assert load_manifest(p) == []
    p.write_text("")
    assert load_manifest(p) == []


@pytest.mark.parametrize(
    "item, needle",
    [
        ("- slug: a\n  ref: x\n  date: 2026-01-01\n  title: t\n", "summary"),
        ("- ref: x\n  date: 2026-01-01\n  title: t\n  summary: s\n", "slug"),
        ("- slug: Bad_Slug\n  ref: x\n  date: 2026-01-01\n  title: t\n  summary: s\n", "Bad_Slug"),
        ("- slug: a\n  ref: x\n  date: not-a-date\n  title: t\n  summary: s\n", "date"),
        ("- slug: a\n  ref: x\n  date: 2026-01-01\n  title: t\n  summary: s\n  tags: nope\n", "tags"),
        ("- slug: a\n  ref: x\n  date: 2026-09-20 10:30:00\n  title: t\n  summary: s\n", "date"),
        ("- slug: a\n  ref: ../x\n  date: 2026-01-01\n  title: t\n  summary: s\n", "ref"),
        (
            "- slug: a\n  ref: x\n  date: 2026-01-01\n  title: t\n  summary: s\n  math: yes-please\n",
            "math",
        ),
        (
            "- slug: a\n  ref: x\n  date: 2026-01-01\n  title: t\n  summary: s\n  cover: sub/a.png\n",
            "cover",
        ),
    ],
)
def test_invalid_entries(tmp_path, item, needle):
    p = tmp_path / "posts.yaml"
    p.write_text(item)
    with pytest.raises(ManifestError, match=needle):
        load_manifest(p)


def test_duplicate_slug(tmp_path):
    p = tmp_path / "posts.yaml"
    p.write_text(GOOD.replace("slug: second", "slug: hello-blog"))
    with pytest.raises(ManifestError, match="hello-blog"):
        load_manifest(p)


def test_math_true_loads(tmp_path):
    p = tmp_path / "posts.yaml"
    p.write_text("- slug: a\n  ref: x\n  date: 2026-01-01\n  title: t\n  summary: s\n  math: true\n")
    posts = load_manifest(p)
    assert posts[0].math is True


def test_cover_loads(tmp_path):
    p = tmp_path / "posts.yaml"
    p.write_text("- slug: a\n  ref: x\n  date: 2026-01-01\n  title: t\n  summary: s\n  cover: hero.png\n")
    assert load_manifest(p)[0].cover == "hero.png"

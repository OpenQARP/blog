from pathlib import Path

from scripts.fetch_posts import load_manifest


def test_real_manifest_loads_and_has_figures():
    posts = load_manifest(Path("posts.yaml"))
    # An empty manifest is valid: markdown posts do not appear here.
    for post in posts:
        assert Path("figures", post.slug).is_dir()

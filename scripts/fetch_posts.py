"""Turn the manifest of notebook posts into Hugo page bundles.

Notebooks are fetched from OpenQARP/openqarp at the pinned ref, stripped
of outputs; figures come from figures/<slug>/ in this repo.
"""

from __future__ import annotations

import argparse
import datetime
import re
import shutil
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import nbformat
import yaml

FENCE = "```"


def _image_re(slug: str) -> re.Pattern[str]:
    # figures/<slug>/NAME where NAME stops at a delimiter markdown or HTML would use
    return re.compile(rf"figures/{re.escape(slug)}/([^\s)\"'>]+)")


def convert_notebook(nb: nbformat.NotebookNode, slug: str) -> tuple[str, list[str]]:
    """Return (markdown body, referenced image names) for one notebook."""
    image_re = _image_re(slug)
    images: list[str] = []
    chunks: list[str] = []
    for cell in nb.cells:
        if "hide" in cell.get("metadata", {}).get("tags", []):
            continue
        source = cell.source.rstrip()
        if not source.strip():
            continue
        if cell.cell_type == "markdown":
            for name in image_re.findall(source):
                if name not in images:
                    images.append(name)
            chunks.append(image_re.sub(r"\1", source))
        elif cell.cell_type == "code":
            chunks.append(f"{FENCE}python\n{source}\n{FENCE}")
    return "\n\n".join(chunks) + "\n", images


SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
REF_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._/-]*")
REQUIRED = ("slug", "ref", "date", "title", "summary", "authors")


class ManifestError(ValueError):
    """A posts.yaml entry that cannot be published."""


@dataclass(frozen=True)
class Post:
    slug: str
    ref: str
    date: datetime.date
    title: str
    summary: str
    authors: tuple[str, ...]
    tags: tuple[str, ...] = ()
    math: bool = False
    cover: str | None = None


def _post_from_item(item: object, index: int) -> Post:
    if not isinstance(item, dict):
        raise ManifestError(f"entry {index}: expected a mapping")
    label = item.get("slug", f"entry {index}")
    missing = [k for k in REQUIRED if k not in item]
    if missing:
        raise ManifestError(f"{label}: missing {', '.join(missing)}")
    slug = str(item["slug"])
    if not SLUG_RE.match(slug):
        raise ManifestError(f"{slug}: slug must be lowercase words joined by hyphens")
    ref = str(item["ref"])
    if not REF_RE.fullmatch(ref) or ".." in ref:
        raise ManifestError(f"{slug}: ref must be a git ref (tag, branch or commit)")
    date = item["date"]
    if type(date) is not datetime.date:
        raise ManifestError(f"{slug}: date must be YYYY-MM-DD")
    authors = item["authors"]
    if not isinstance(authors, list) or not authors or not all(isinstance(a, str) and SLUG_RE.match(a) for a in authors):
        raise ManifestError(f"{slug}: authors must be a non-empty list of ids from site/data/authors.yaml")
    tags = item.get("tags", [])
    if not isinstance(tags, list) or not all(isinstance(t, str) for t in tags):
        raise ManifestError(f"{slug}: tags must be a list of strings")
    math = item.get("math", False)
    if not isinstance(math, bool):
        raise ManifestError(f"{slug}: math must be true or false")
    cover = item.get("cover")
    if cover is not None and (not isinstance(cover, str) or Path(cover).name != cover or not cover):
        raise ManifestError(f"{slug}: cover must be a plain file name in figures/{slug}/")
    return Post(
        slug=slug, ref=ref, date=date, title=str(item["title"]),
        summary=str(item["summary"]), authors=tuple(authors), tags=tuple(tags), math=math, cover=cover,
    )


def load_manifest(path: Path) -> list[Post]:
    data = yaml.safe_load(path.read_text()) or []
    if not isinstance(data, list):
        raise ManifestError("posts.yaml must be a list")
    posts = [_post_from_item(item, i) for i, item in enumerate(data)]
    seen: set[str] = set()
    for post in posts:
        if post.slug in seen:
            raise ManifestError(f"{post.slug}: duplicate slug")
        seen.add(post.slug)
    return posts


RAW_BASE = "https://raw.githubusercontent.com/OpenQARP/openqarp"
BLOB_BASE = "https://github.com/OpenQARP/openqarp/blob"


class BundleError(ValueError):
    """A post that cannot be built into a bundle."""


def front_matter(post: Post) -> str:
    data = {
        "title": post.title,
        "date": post.date,
        "summary": post.summary,
        "authors": list(post.authors),
        "tags": list(post.tags),
        "math": post.math,
        "notebook_ref": post.ref,
        "notebook_url": f"{BLOB_BASE}/{post.ref}/examples/blog/{post.slug}.ipynb",
    }
    if post.cover:
        data["cover"] = post.cover
    return "---\n" + yaml.safe_dump(data, sort_keys=False, allow_unicode=True) + "---\n"


def write_bundle(post: Post, body: str, images: list[str], figures_dir: Path, out_dir: Path) -> Path:
    src = figures_dir / post.slug
    bundle = out_dir / "posts" / post.slug
    bundle.mkdir(parents=True, exist_ok=True)
    # the cover is copied like a referenced figure even when no markdown cell shows it
    if post.cover and post.cover not in images:
        images = [*images, post.cover]
    for name in images:
        if Path(name).name != name or name in (".", ".."):
            raise BundleError(f"{post.slug}: figure name {name!r} must be a plain file name")
        if not (src / name).is_file():
            raise BundleError(f"{post.slug}: missing figure {name} (expected {src / name})")
        shutil.copyfile(src / name, bundle / name)
    if src.is_dir():
        for stray in sorted(p.name for p in src.iterdir() if p.is_file() and p.name not in images):
            print(f"warning: {post.slug}: unreferenced figure {stray}", file=sys.stderr)
    (bundle / "index.md").write_text(front_matter(post) + body)
    return bundle


def check_no_shadow(posts: list[Post], content_dir: Path) -> None:
    for post in posts:
        if (content_dir / "posts" / post.slug).exists():
            raise BundleError(f"{post.slug}: exists in both posts.yaml and {content_dir / 'posts'}")


def fetch_notebook(slug: str, ref: str, opener=urllib.request.urlopen) -> nbformat.NotebookNode:
    url = f"{RAW_BASE}/{ref}/examples/blog/{slug}.ipynb"
    try:
        with opener(url, timeout=30) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:
        raise BundleError(f"{slug}@{ref}: HTTP {e.code} for {url}") from e
    except OSError as e:
        raise BundleError(f"{slug}@{ref}: cannot fetch {url}: {getattr(e, 'reason', e)}") from e
    try:
        return nbformat.reads(raw.decode("utf-8"), as_version=4)
    except (ValueError, nbformat.ValidationError) as e:
        raise BundleError(f"{slug}@{ref}: not a notebook: {e}") from e


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--manifest", type=Path, default=Path("posts.yaml"))
    ap.add_argument("--figures", type=Path, default=Path("figures"))
    ap.add_argument("--content", type=Path, default=Path("site/content"))
    ap.add_argument("--out", type=Path, default=Path("site/_generated"))
    args = ap.parse_args(argv)
    # A slug removed from the manifest must stop rendering locally, not linger from a prior run.
    shutil.rmtree(args.out / "posts", ignore_errors=True)
    (args.out / "posts").mkdir(parents=True, exist_ok=True)
    try:
        posts = load_manifest(args.manifest)
        check_no_shadow(posts, args.content)
        for post in posts:
            nb = fetch_notebook(post.slug, post.ref)
            body, images = convert_notebook(nb, post.slug)
            bundle = write_bundle(post, body, images, args.figures, args.out)
            print(f"{post.slug}@{post.ref} -> {bundle}")
    except (ManifestError, BundleError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

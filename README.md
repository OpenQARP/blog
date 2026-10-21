# OpenQARP blog

Source of https://blog.openqarp.com. Built with Hugo; deployed by GitHub Actions on every push to `main`.

## Two kinds of post

- **Notebook post** — for anything with code that should stay true over time. The source is a
  notebook in the main repo, `examples/blog/<slug>.ipynb`, executed nightly there. This repo
  holds only the pin (`posts.yaml`) and the figures (`figures/<slug>/`).
- **Markdown post** — announcements, release notes, opinion. A Hugo page bundle in
  `site/content/posts/<slug>/index.md` with its images beside it.

A slug lives in exactly one of the two places.

## Writing a notebook post

1. In the main repo, create `examples/blog/<slug>.ipynb`. Markdown cells are the prose, code
   cells are the snippets. Save figures from code into `figures/<slug>/` (gitignored there) and
   reference them in markdown as `![caption](figures/<slug>/name.png)`. Tag a cell `hide` to keep
   it out of the post. Numbers the prose depends on go in the prose.
2. Run it end to end, then `pytest --nbmake examples/blog/<slug>.ipynb`.
3. Commit (the pre-commit hook strips outputs), open a PR, merge. Note the merge commit or wait
   for the next tag.
4. Here: copy the PNGs to `figures/<slug>/`, add an entry to `posts.yaml`:
   ```yaml
   - slug: <slug>
     ref: v0.1.0
     date: 2026-09-20
     title: "…"
     summary: "…"
     authors: [<id>]  # ids from site/data/authors.yaml
     tags: [vqe]
     math: true  # loads KaTeX; omit when there is no math
     cover: convergence.png  # optional: a figure from figures/<slug>/, shown next to the post in the list
   ```
5. Preview: `python scripts/fetch_posts.py && hugo server -s site`.
6. Open a PR; merging to `main` deploys.

Revising a published post: edit the notebook in the main repo, merge, bump `ref`, replace changed figures.

## Writing a markdown post

Create `site/content/posts/<slug>/index.md`:

```markdown
---
title: "…"
date: 2026-09-20
summary: "…"
authors: [<id>]  # ids from site/data/authors.yaml
tags: [release]
math: true  # loads KaTeX; omit when there is no math
cover: hero.png  # optional: an image in the post folder, shown next to the post in the list
---
Body.
```

Preview with `python scripts/fetch_posts.py && hugo server -s site` (the fetch also creates the mounted `_generated` folder Hugo needs), open a PR, merge.

## Authors

Every post names its authors. Add yourself once to `site/data/authors.yaml`:

```yaml
<id>:
  name: Your Name
  affiliation: Your Institution  # optional
  url: https://…                 # optional, linked from the byline
```

Then list the id under `authors` in the post. A post with no author, or with an id
that is not in the file, fails the build.

## Charts

A bar chart is a shortcode with one `label | value` line per bar. Bars start at zero
and every value is printed. `highlight` names the row that takes the accent colour.

```
{{< bars title="…" note="unit and direction, e.g. lower is better" unit=" ms" highlight="OpenQARP" >}}
OpenQARP | 41.3
Other | 51.9
{{< /bars >}}
```

## Local setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pytest
```

Hugo extended 0.166.0: https://github.com/gohugoio/hugo/releases/tag/v0.166.0

## First deploy

GitHub Pages ignores the `CNAME` file when a site is published by an Actions
workflow. One-time settings in the repo: Settings → Pages → Source
"GitHub Actions"; Custom domain `blog.openqarp.com`; tick "Enforce HTTPS" once
the certificate check passes. The DNS record is `blog CNAME openqarp.github.io`
in the `openqarp.com` zone.

The deploy carries the markdown posts under `site/content/posts/` and an empty
`posts.yaml`. The first notebook post arrives with the first use case.

## Post kinds and tags

One or two posts a week, of different kinds. Tag every post with one kind so
readers can follow only what they want:

| Kind | Tag | Form |
|---|---|---|
| Releases, workshops, talks, events, collaborations | `news` | markdown |
| Guides to installing and using the framework | `tutorial` | markdown |
| Conversations with the people who build and use the framework | `interview` | markdown |
| Worked problems from a domain | `use-case` | notebook |
| Recent algorithms implemented in OpenQARP | `research-radar` | notebook |
| PhD-hosted write-ups of work implemented in OpenQARP | `contribution` | notebook |

Add topical tags after the kind (`vqe`, `chemistry`, `release`, …).

Every post gets a small dot sketch next to it in the list, generated from its
address. Set `cover` in the front matter (or the manifest) to show an image
from the post's folder instead; square images look best.

A shared link shows `site/static/card.png` as its preview image. A post with a PNG
or JPEG `cover` shows the cover instead, as a small square card.

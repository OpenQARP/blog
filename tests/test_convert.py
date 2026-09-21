import nbformat

from scripts.fetch_posts import convert_notebook


def nb(*cells):
    """Build a v4 notebook from (cell_type, source[, tags]) tuples."""
    out = nbformat.v4.new_notebook()
    for cell in cells:
        kind, src, *rest = cell
        c = nbformat.v4.new_markdown_cell(src) if kind == "md" else nbformat.v4.new_code_cell(src)
        if rest:
            c.metadata["tags"] = list(rest[0])
        out.cells.append(c)
    return out


def test_markdown_and_code_cells_in_order():
    body, images = convert_notebook(nb(("md", "# Title\n\nIntro."), ("code", "x = 1\nprint(x)")), "p")
    assert body == "# Title\n\nIntro.\n\n```python\nx = 1\nprint(x)\n```\n"
    assert images == []


def test_hidden_and_blank_cells_are_dropped():
    body, _ = convert_notebook(
        nb(("code", "setup()", ["hide"]), ("md", "   \n"), ("code", ""), ("md", "kept")), "p"
    )
    assert body == "kept\n"


def test_outputs_are_ignored():
    n = nb(("code", "1 + 1"))
    n.cells[0].outputs = [nbformat.v4.new_output("execute_result", data={"text/plain": "2"}, execution_count=1)]
    body, _ = convert_notebook(n, "p")
    assert "2\n" not in body and body.endswith("1 + 1\n```\n")


def test_image_paths_are_rewritten_and_collected():
    src = "![a](figures/my-post/a.png) and <img src=\"figures/my-post/b.png\"> and ![a](figures/my-post/a.png)"
    body, images = convert_notebook(nb(("md", src)), "my-post")
    assert body == "![a](a.png) and <img src=\"b.png\"> and ![a](a.png)\n"
    assert images == ["a.png", "b.png"]


def test_other_slugs_figures_are_left_alone():
    body, images = convert_notebook(nb(("md", "![x](figures/other/x.png)")), "my-post")
    assert body == "![x](figures/other/x.png)\n"
    assert images == []

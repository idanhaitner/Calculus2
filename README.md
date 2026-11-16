# Calculus 2 summary (website)

A full summary of the Calculus 2 course (Hebrew): integrals in one variable, vectors, functions of several variables and multiple integrals. It has worked examples, interactive figures and self-check quizzes.

The site is static HTML, built for GitHub Pages. Each chapter is its own page, so a visitor only loads the chapter they open. The shared style and script (`assets/`) are downloaded once and then cached.

## Structure

| Path | What it is |
|---|---|
| `index.html` | Cover, course map, PDF downloads |
| `chapter-1.html` … `chapter-24.html` | One page per chapter (the part opener sits on the first chapter of each part) |
| `worksheet-1.html` … `worksheet-3.html` | Worksheets with hints and full solutions |
| `assets/style.css`, `assets/app.js` | Shared styles, figures, quizzes |
| `downloads/` | The full summary and the worksheets as PDF |
| `404.html`, `.nojekyll` | GitHub Pages extras |
| `build.py` | Generates all of the above |

## Updating

The generated pages are not edited by hand. The single source file is
`../סיכום למבחן - חדוא 2.html` (one folder up). The PDFs are also printed from it.

1. Edit the source file.
2. Regenerate the PDFs from it (headless Chrome `--print-to-pdf`; add `?worksheets` to the URL for the worksheets PDF).
3. Rebuild the site:
   ```bash
   python3 build.py
   ```
   The script rewrites every in-page link (`#c5`, `#c22-e1`, …) to the page that holds it. It stops with an error if a link points nowhere.
4. Commit and push.

## Publishing on GitHub Pages

In the repository: **Settings → Pages → Build and deployment → Deploy from a branch**, branch `main`, folder `/ (root)`.

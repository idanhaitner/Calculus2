#!/usr/bin/env python3
"""Build the GitHub Pages site from the single-file summary.

The single HTML file stays the one source of truth (it also produces the PDFs).
This script splits it into one page per chapter / worksheet, so a visitor only
loads the chapter they open, and rewrites every in-page link (#c5, #c22-e1, ...)
to point at the page that now holds that id.

Usage (from this folder):
    python3 build.py                     # source = ../סיכום למבחן - חדוא 2.html
    python3 build.py path/to/source.html

Output is written next to this script: index.html, chapter-N.html,
worksheet-N.html, assets/, downloads/, 404.html, .nojekyll.
"""
import html
import json
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent / "סיכום למבחן - חדוא 2.html"
PDFS = {  # source PDF (next to the source HTML) -> published name
    "סיכום למבחן - חדוא 2.pdf": "calculus-2-summary.pdf",
    "דפי עבודה.pdf": "calculus-2-worksheets.pdf",
}
SITE_TITLE = "חדו״א 2"


def plain(tex_title):
    """Tab titles and tooltips can't render math: turn the few TeX bits used in titles into Unicode."""
    t = re.sub(r"\\\(\\mathbb\s*\{?R\}?\^n\\\)", "ℝⁿ", tex_title)
    return re.sub(r"\\[()]", "", t)


def die(msg):
    sys.exit("build.py: " + msg)


src = SRC.read_text(encoding="utf-8")

# ---------------------------------------------------------------- pieces of the source
style = re.search(r"<style>(.*?)</style>", src, re.S).group(1)
app_js = max(re.findall(r"<script>(.*?)</script>", src, re.S), key=len)  # the big app/figures script
# every external <link> and <script src> from the source <head>, verbatim (fonts, KaTeX + its auto-render add-on)
head_src = src[:src.index("</head>")]
head_links = "\n".join(m.group(0) for m in re.finditer(r"<link [^>]*>|<script [^>]*\bsrc=\"[^\"]+\"[^>]*></script>", head_src))
main = re.search(r"<main>(.*?)</main>", src, re.S).group(1)

# split <main> into top-level blocks at known openers
openers = re.compile(
    r'<header class="cover"|<div class="intro">|<details class="mobile-toc">|<section id="map"'
    r'|<div class="part-head" id="part[A-E]"|<section id="c\d+"|<h2 class="part-title ws-part">'
    r'|<section id="w\d"|<section id="ans"'
)
starts = [m.start() for m in openers.finditer(main)] + [len(main)]
blocks = []
for a, b in zip(starts, starts[1:]):
    chunk = main[a:b]
    chunk = re.sub(r"\s*<!-- =+ [^>]*=+ -->\s*$", "\n", chunk)  # banner comment of the next block
    m = re.match(r'<(?:section|div class="part-head") id="([^"]+)"', chunk)
    key = m.group(1) if m else ("cover" if chunk.startswith("<header") else
                                "intro" if chunk.startswith('<div class="intro"') else
                                "mobile-toc" if chunk.startswith("<details") else "ws-title")
    blocks.append((key, chunk.strip()))
block = dict(blocks)

# ---------------------------------------------------------------- course model
chapters = []  # in course order
for key, chunk in blocks:
    m = re.match(r'<section id="(c\d+)" class="chapter" data-part="([A-E])">', chunk)
    if m:
        num = re.search(r'<div class="ch-num">(\d+)</div>', chunk).group(1)
        title = re.search(r"<h2>(.*?)</h2>", chunk, re.S).group(1)
        chapters.append({"id": m.group(1), "num": num, "part": m.group(2),
                         "title": plain(html.unescape(re.sub(r"<[^>]+>", "", title))),
                         "href": f"chapter-{num}.html"})
worksheets = [k for k, _ in blocks if re.fullmatch(r"w\d", k)]

pages = []  # (filename, title, [block keys], nav-id)
pages.append(("index.html", None, ["cover", "map"], "map"))
first_of_part = {}
for c in chapters:
    first_of_part.setdefault(c["part"], c["id"])
order = [k for k, _ in blocks if re.fullmatch(r"c\d+|w\d", k)]  # source order: c1..c20, w1..w3, c21..c24
for k in order:
    if k.startswith("c"):
        c = next(c for c in chapters if c["id"] == k)
        keys = ([f"part{c['part']}"] if first_of_part[c["part"]] == k else []) + [k]
        pages.append((c["href"], f"{c['num']}. {c['title']}", keys, k))
    else:
        n = k[1:]
        title = re.sub(r"<[^>]+>", "", re.search(r"<h2>(.*?)</h2>", block[k], re.S).group(1))
        pages.append((f"worksheet-{n}.html", plain(html.unescape(title)), [k], k))


def page_html(keys):
    out = []
    for k in keys:
        chunk = block[k]
        chunk = re.sub(r'<div class="practice" id="p-[^"]+">.*?</div>\s*(?=</section>)', "", chunk, flags=re.S)  # print-only
        out.append(chunk)
    return "\n\n".join(out)


contents = {fn: page_html(keys) for fn, _, keys, _ in pages}

# id -> page that holds it
where = {}
for fn, _, keys, _ in pages:
    for i in re.findall(r'\bid="([^"]+)"', contents[fn]):
        where.setdefault(i, fn)
where["top"] = "index.html"
primary = {nav: fn for fn, _, _, nav in pages}  # ids that ARE a whole page -> no fragment needed
for p, cid in first_of_part.items():
    primary[f"part{p}"] = where[f"part{p}"]

unresolved = set()


def rewrite(text, here):
    def fix(m):
        target = m.group(1)
        fn = where.get(target)
        if fn is None:
            unresolved.add((here, target))
            return m.group(0)
        if fn == here:
            return f'href="#{target}"'
        return f'href="{fn}"' if primary.get(target) == fn else f'href="{fn}#{target}"'
    return re.sub(r'href="#([^"]+)"', fix, text)


# ---------------------------------------------------------------- navigation
toc_src = re.search(r'<nav class="toc".*?</nav>', src, re.S).group(0)
toc_src = re.sub(r'\s*<a href="#ans">.*?</a>', "", toc_src)  # answer key is print-only
mobile_src = block["mobile-toc"]
mobile_src = re.sub(r'<a href="#ans">.*?</a>', "", mobile_src)


def nav_for(fn, nav_id):
    t = rewrite(toc_src, "__nav__")
    t = t.replace(f'href="{fn}"', f'href="{fn}" class="on" aria-current="page"', 1)
    t = t.replace('<h2>תוכן עניינים</h2>', '<a class="home" href="index.html">חדו״א 2 · סיכום הקורס</a>\n  <h2>תוכן עניינים</h2>')
    return t


def pager(i):
    prev_p = pages[i - 1] if i > 0 else None
    next_p = pages[i + 1] if i + 1 < len(pages) else None
    def card(p, cls, label):
        if not p:
            return '<span class="pg-spacer"></span>'
        t = p[1] or "מפת הקורס"
        return f'<a class="pg {cls}" href="{p[0]}"><small>{label}</small><span>{html.escape(t)}</span></a>'
    return f'<nav class="pager" aria-label="ניווט בין פרקים">{card(prev_p, "pg-prev", "→ הקודם")}{card(next_p, "pg-next", "הבא ←")}</nav>'


downloads = """
<section class="downloads" id="downloads">
  <h2>להורדה</h2>
  <div class="dl-grid">
    <a class="dl" href="downloads/calculus-2-summary.pdf" download><b>הסיכום המלא (PDF)</b><small>כל הפרקים, עם תרגול ומפתח תשובות</small></a>
    <a class="dl" href="downloads/calculus-2-worksheets.pdf" download><b>דפי עבודה (PDF)</b><small>שאלות עם פתרונות מלאים</small></a>
  </div>
</section>"""

site_css = """
/* ================= site (multi-page) ================= */
nav.toc a.home{font-weight:800;font-size:16px;color:var(--text);padding:0 10px 14px;border:0;background:none}
nav.toc a.home:hover{background:none;color:var(--accent)}
.pager{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:56px 0 0;padding-top:22px;border-top:1px solid var(--border)}
.pg{display:flex;flex-direction:column;gap:2px;padding:12px 16px;border:1.5px solid var(--border);border-radius:14px;text-decoration:none;color:var(--text);background:var(--surface);transition:border-color .15s}
.pg:hover{border-color:var(--accent)}
.pg small{color:var(--muted);font-weight:700;font-size:13px}
.pg span{font-weight:800;line-height:1.35}
.pg-next{text-align:left}
.downloads{margin:28px 0}
.downloads h2{font-size:24px;margin:0 0 10px;font-weight:800}
.dl-grid{display:grid;gap:12px}
@media (min-width:720px){.dl-grid{grid-template-columns:1fr 1fr}}
.dl{display:block;padding:14px 18px;border:1.5px solid var(--border);border-radius:14px;text-decoration:none;color:var(--text);background:var(--surface)}
.dl:hover{border-color:var(--accent)}
.dl b{display:block}
.dl small{color:var(--muted)}
.site-foot{margin:40px 0 0;color:var(--muted);font-size:14px}
"""

FAVICON = ("data:image/svg+xml," + "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%233b4ea8'/%3E"
           "%3Ctext x='32' y='47' font-size='42' text-anchor='middle' fill='white' font-family='serif' font-style='italic'%3E%E2%88%AB%3C/text%3E%3C/svg%3E")


def document(fn, title, body, nav_id, i):
    full_title = f"{title} · {SITE_TITLE}" if title else f"{SITE_TITLE} · סיכום הקורס"
    is_index = fn == "index.html"
    mobile = rewrite(mobile_src, fn)
    content = rewrite(body, fn)
    if is_index:  # home: cover, mobile TOC, course map, then the PDF downloads
        content = content.replace('<section id="map"', mobile + '\n\n<section id="map"', 1) + "\n\n" + downloads
        mobile = ""
    return f"""<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(full_title)}</title>
<meta name="description" content="סיכום מלא של קורס חדו״א 2: אינטגרלים, וקטורים, פונקציות של כמה משתנים ואינטגרלים מרובים, עם דוגמאות מלאות, שרטוטים אינטראקטיביים ושאלות לבדיקה עצמית.">
<link rel="icon" href="{FAVICON}">
{head_links}
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<div class="layout">

{nav_for(fn, nav_id)}

<main>
{mobile}

{content}

{pager(i)}
</main>
</div>
<script>window.COURSE = {json.dumps(chapters, ensure_ascii=False)};</script>
<script src="assets/app.js"></script>
</body>
</html>
"""


# ---------------------------------------------------------------- write
(HERE / "assets").mkdir(exist_ok=True)
(HERE / "assets" / "style.css").write_text(style.strip() + "\n" + site_css, encoding="utf-8")
(HERE / "assets" / "app.js").write_text(app_js.strip() + "\n", encoding="utf-8")
for i, (fn, title, keys, nav_id) in enumerate(pages):
    (HERE / fn).write_text(document(fn, title, contents[fn], nav_id, i), encoding="utf-8")

(HERE / "downloads").mkdir(exist_ok=True)
for name, out in PDFS.items():
    p = SRC.parent / name
    if p.exists():
        shutil.copyfile(p, HERE / "downloads" / out)
    else:
        print(f"warning: {p} not found, downloads/{out} not updated")

(HERE / ".nojekyll").write_text("", encoding="utf-8")
(HERE / "404.html").write_text(f"""<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>הדף לא נמצא · {SITE_TITLE}</title><link rel="icon" href="{FAVICON}"><link rel="stylesheet" href="assets/style.css"></head>
<body><div class="layout"><main style="padding:80px 0">
<h1 style="font-size:40px;margin:0 0 10px">הדף לא נמצא</h1>
<p>ייתכן שהקישור ישן. <a href="index.html">חזרה למפת הקורס</a></p>
</main></div></body></html>
""", encoding="utf-8")

if unresolved:
    die("unresolved links: " + ", ".join(f"{p}→#{t}" for p, t in sorted(unresolved)))
print(f"built {len(pages)} pages from {SRC.name}")

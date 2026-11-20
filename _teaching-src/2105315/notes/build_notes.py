"""Build the before/after-class notes as PDFs into teaching/2105315/notes/.

    python3 _teaching-src/2105315/notes/build_notes.py

Needs Playwright with Chromium (pip install playwright && playwright install chromium).
Content lives in notes_content.py; this file only lays it out.
"""
from pathlib import Path
import html
import re
import sys

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from notes_content import SESSIONS, LABS  # noqa: E402

REPO = HERE.parents[2]
OUT = REPO / 'teaching/2105315/notes'
SITE = 'https://soorathep.github.io/course-2105315/teaching/2105315'
AUTHOR = 'Soorathep Kheawhom, Ph.D., FRSC'

CSS = """
@page { size: A4; margin: 16mm 16mm 18mm; }
:root { --teal:#0F6E6B; --amber:#E29A2D; --ink:#1C242B; --graphite:#333F4A; --slate:#66727C; --mist:#B9C1C6; --paper:#F3F0EB; --sand:#DFC98F; }
* { box-sizing: border-box; }
body { margin: 0; color: var(--ink); font: 10.5pt/1.45 "Source Sans 3", "Helvetica Neue", Arial, sans-serif; }
a { color: var(--teal); }
.sheet { page-break-after: always; }
.sheet:last-child { page-break-after: auto; }
.top { display: flex; justify-content: space-between; font-size: 8.5pt; color: var(--slate); border-bottom: 1px solid var(--mist); padding-bottom: 4px; }
h1 { font-family: "Source Serif 4", Georgia, serif; font-size: 22pt; line-height: 1.15; margin: 10px 0 2px; }
.sub { color: var(--slate); margin: 0 0 8px; }
.links { font-size: 9pt; margin: 0 0 10px; }
.question { border-left: 4px solid var(--amber); background: #FBF0DE; padding: 7px 12px; margin: 0 0 12px; font-family: "Source Serif 4", Georgia, serif; font-size: 11.5pt; }
h2 { font-size: 12.5pt; margin: 14px 0 6px; padding: 4px 10px; color: #fff; border-radius: 3px; break-after: avoid; }
h2.before { background: var(--teal); }
h2.after { background: var(--graphite); }
h3 { font-size: 10.5pt; margin: 10px 0 4px; color: var(--teal); text-transform: uppercase; letter-spacing: .04em; break-after: avoid; }
h2.after + h3, .after-part h3 { color: var(--graphite); }
dl { margin: 0; display: grid; grid-template-columns: 30% 70%; gap: 3px 10px; }
dt { font-weight: 600; } dd { margin: 0; }
ul, ol { margin: 0; padding-left: 18px; } li { margin: 2px 0; }
.think { background: var(--paper); padding: 6px 10px; border-radius: 3px; }
code { font-family: "IBM Plex Mono", Menlo, monospace; font-size: 8.8pt; background: var(--paper); padding: 0 3px; border-radius: 2px; }
table.code { width: 100%; border-collapse: collapse; font-size: 8.6pt; }
table.code td { padding: 3px 6px; vertical-align: top; border-bottom: 1px solid #e3e0da; }
table.code td:first-child { font-family: "IBM Plex Mono", Menlo, monospace; background: #1C242B; color: #F3F0EB; width: 62%; overflow-wrap: anywhere; }
table.code td:last-child { color: var(--slate); }
.q { margin: 4px 0 0; font-weight: 600; } .a { margin: 0 0 4px; padding-left: 12px; border-left: 2px solid var(--sand); }
.foot { margin-top: 12px; font-size: 8pt; color: var(--slate); border-top: 1px solid var(--mist); padding-top: 4px; }
.avoid { break-inside: avoid; }
.cover h1 { font-size: 26pt; margin-top: 40mm; }
.cover ol { font-size: 11pt; } .cover li { margin: 4px 0; }
"""

FONTS = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700'
         '&family=Source+Serif+4:wght@600&family=IBM+Plex+Mono:wght@400&display=swap">')


def md(t):
    """Escape, then `code` and **bold**."""
    t = html.escape(t, quote=False)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    return re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', t)


def sheet(s):
    n = s['n']
    lab_name, lab_q, lab_page = LABS[s['week']]
    slides = f'{SITE}/slides/s{n:02d}.html'
    lab = f'{SITE}/labs/{lab_page}.html'
    terms = ''.join(f'<dt>{md(a)}</dt><dd>{md(b)}</dd>' for a, b in s['terms'])
    before = ''.join(f'<li>{md(x)}</li>' for x in s['before'])
    ideas = ''.join(f'<li>{md(x)}</li>' for x in s['ideas'])
    code = ''.join(f'<tr><td>{html.escape(c)}</td><td>{md(w)}</td></tr>' for c, w in s['code'])
    mistakes = ''.join(f'<li>{md(x)}</li>' for x in s['mistakes'])
    check = ''.join(f'<div class="avoid"><p class="q">{k}. {md(q)}</p><p class="a">{md(a)}</p></div>'
                    for k, (q, a) in enumerate(s['check'], 1))
    after = ''.join(f'<li>{md(x)}</li>' for x in s['after'])
    return f"""<section class="sheet">
<div class="top"><span>2105315 Data Analytics in Chemical Engineering · Week {s['week']}</span><span>Session {n} of 14 · Notes</span></div>
<h1>{md(s['title'])}</h1>
<p class="sub">{md(s['sub'])} · {AUTHOR}</p>
<p class="links">Slides: <a href="{slides}">Session {n}</a> · Lab: <a href="{lab}">{lab_name} · {md(lab_q)}</a></p>
<p class="question">{md(s['question'])}</p>
<h2 class="before">Before class · about 10 minutes</h2>
<h3>Words you will need</h3><dl>{terms}</dl>
<h3>Do before you come</h3><ul>{before}</ul>
<h3>Think about</h3><p class="think">{md(s['think'])}</p>
<h2 class="after">After class · about 15 minutes</h2>
<div class="after-part">
<h3>Key ideas</h3><ul>{ideas}</ul>
<div class="avoid"><h3>Code to read, not to memorize</h3><table class="code">{code}</table></div>
<h3>Common mistakes</h3><ul>{mistakes}</ul>
<h3>Check yourself</h3>{check}
<h3>Next</h3><ul>{after}</ul>
</div>
<p class="foot">Numbers are from the course data: S. De Vito, Air Quality, UCI Machine Learning Repository, doi:10.24432/C59K5F, CC BY 4.0. Course site: {SITE}/labs/</p>
</section>"""


def cover():
    items = ''.join(f'<li>Session {s["n"]} · {md(s["title"])} <span style="color:#66727C">· {md(s["sub"])}</span></li>' for s in SESSIONS)
    return f"""<section class="sheet cover">
<div class="top"><span>2105315 Data Analytics in Chemical Engineering</span><span>Semester 2/2026</span></div>
<h1>Notes before and after class</h1>
<p class="sub">Sessions 1 to 14 · {AUTHOR} · Chulalongkorn University</p>
<p>Each session has one sheet. Read <strong>Before class</strong> (about 10 minutes) before you come: the words you will need, what to bring, and one question to think about. Read <strong>After class</strong> (about 15 minutes) the same week: the key ideas with the numbers from the slides, the code to read, common mistakes, three questions to check yourself, and what to do next.</p>
<ol>{items}</ol>
</section>"""


def page(body, title):
    return f'<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{html.escape(title)}</title>{FONTS}<style>{CSS}</style></head><body>{body}</body></html>'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        def pdf(body, title, path):
            pg.set_content(page(body, title), wait_until='networkidle')
            pg.wait_for_timeout(300)
            pg.pdf(path=str(path), format='A4', print_background=True, prefer_css_page_size=True)
            print(path.relative_to(REPO))
        for s in SESSIONS:
            pdf(sheet(s), f'2105315 Session {s["n"]} notes', OUT / f'2105315-s{s["n"]:02d}-notes.pdf')
        pdf(cover() + ''.join(sheet(s) for s in SESSIONS), '2105315 notes, Sessions 1 to 14', OUT / '2105315-notes-s01-s14.pdf')
        b.close()


if __name__ == '__main__':
    main()

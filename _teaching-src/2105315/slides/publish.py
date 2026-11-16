"""Copy a rendered deck from _site/ to teaching/2105315/slides/.

    quarto render s01.qmd && python3 publish.py
"""
from pathlib import Path
import shutil

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
DEST = REPO / 'teaching/2105315/slides'

import hashlib
# Browsers keep slides.css for 10 minutes (GitHub Pages max-age=600). Versioning the link
# makes every published deck load the stylesheet it was rendered with.
css = HERE / '_site' / 'slides.css'
version = hashlib.md5(css.read_bytes()).hexdigest()[:8] if css.exists() else ''

for path in sorted((HERE / '_site').rglob('*')):
    if path.is_dir():
        continue
    target = DEST / path.relative_to(HERE / '_site')
    target.parent.mkdir(parents=True, exist_ok=True)
    if path.suffix == '.html' and version:
        html = path.read_text(encoding='utf-8').replace('href="slides.css"', f'href="slides.css?v={version}"')
        target.write_text(html, encoding='utf-8')
    else:
        shutil.copyfile(path, target)
    print(target.relative_to(REPO))

# Thai caption font (OFL), shared by every course at a fixed path.
fonts = REPO / 'teaching/shared/fonts'
fonts.mkdir(parents=True, exist_ok=True)
for name in ('Sarabun-Regular.ttf', 'LICENSE_SARABUN.txt'):
    src = REPO / 'teaching/2105603/assets' / name
    if src.exists():          # course-2105315 repo already carries the shared copy
        shutil.copyfile(src, fonts / name)

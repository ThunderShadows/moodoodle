"""Regenerates site/privacy.html from docs/privacy.md (the single source of truth).

Usage: python3 scripts/build-privacy-page.py
"""
import html
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
md = (root / 'docs/privacy.md').read_text()


def inline(text: str) -> str:
    text = html.escape(text)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    return re.sub(r'_(.+?)_', r'<em>\1</em>', text)


out: list[str] = []
para: list[str] = []
in_list = False


def flush() -> None:
    if para:
        out.append('<p>' + inline(' '.join(para)) + '</p>')
        para.clear()


for line in md.splitlines():
    s = line.strip()
    if s.startswith('# '):
        flush()
        out.append('<h1>' + inline(s[2:]) + '</h1>')
    elif s.startswith('## '):
        flush()
        if in_list:
            out.append('</ul>')
            in_list = False
        out.append('<h2>' + inline(s[3:]) + '</h2>')
    elif s.startswith('- '):
        flush()
        if not in_list:
            out.append('<ul>')
            in_list = True
        out.append('<li>' + inline(s[2:]) + '</li>')
    elif not s:
        flush()
        if in_list:
            out.append('</ul>')
            in_list = False
    else:
        para.append(s)
flush()
if in_list:
    out.append('</ul>')

body = '\n'.join(out)
(root / 'site/privacy.html').write_text(f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>kudoodle · privacy policy</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<main>
<a class="home" href="./">kudoodle</a>
{body}
</main>
</body>
</html>
''')
print('wrote site/privacy.html')

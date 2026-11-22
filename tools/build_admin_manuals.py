from pathlib import Path
import html

import markdown
from weasyprint import HTML


ROOT = Path(__file__).resolve().parents[1]
MANUALS = {
    'en': (
        ROOT / 'docs' / 'ADMINISTRATOR_HANDBOOK.en.md',
        ROOT / 'frontend' / 'public' / 'admin-manual.en.pdf',
    ),
    'it': (
        ROOT / 'docs' / 'ADMINISTRATOR_HANDBOOK.it.md',
        ROOT / 'frontend' / 'public' / 'admin-manual.it.pdf',
    ),
    'de': (
        ROOT / 'docs' / 'ADMINISTRATOR_HANDBUCH.de.md',
        ROOT / 'frontend' / 'public' / 'admin-manual.de.pdf',
    ),
}

STYLES = """
@page {
  size: A4;
  margin: 19mm 18mm 18mm;
  @top-left {
    content: "VstPBX";
    color: #64748b;
    font-size: 8pt;
  }
  @top-right {
    content: string(section-title);
    color: #64748b;
    font-size: 8pt;
  }
  @bottom-right {
    content: counter(page);
    color: #64748b;
    font-size: 8pt;
  }
}
body {
  color: #1e293b;
  font-family: "DejaVu Sans", sans-serif;
  font-size: 9.5pt;
  line-height: 1.5;
}
h1 {
  color: #145a86;
  font-size: 25pt;
  line-height: 1.2;
  string-set: section-title content();
}
h2 {
  color: #145a86;
  font-size: 15pt;
  margin-top: 20pt;
  break-after: avoid;
}
h3 {
  font-size: 11pt;
  margin-top: 14pt;
  break-after: avoid;
}
p, li {
  orphans: 3;
  widows: 3;
}
li {
  margin-bottom: 4pt;
}
table {
  border-collapse: collapse;
  font-size: 8.5pt;
  margin: 10pt 0 14pt;
  width: 100%;
}
th, td {
  border: 1px solid #cbd5e1;
  padding: 6pt;
  text-align: left;
  vertical-align: top;
}
th {
  background: #eaf2f8;
}
pre {
  background: #f1f5f9;
  border: 1px solid #dbe3eb;
  font-size: 7.5pt;
  padding: 8pt;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}
code {
  font-family: "DejaVu Sans Mono", monospace;
  font-size: 0.9em;
}
a {
  color: #145a86;
  text-decoration: none;
}
.toc {
  background: #f8fafc;
  border: 1px solid #dbe3eb;
  margin: 18pt 0;
  padding: 10pt 16pt;
}
.toc ul {
  margin: 5pt 0;
}
"""


def build_manual(language: str, source_path: Path, output_path: Path) -> None:
    source = source_path.read_text(encoding='utf-8')
    body = markdown.markdown(source, extensions=['fenced_code', 'tables', 'toc'])
    document = f"""<!doctype html>
<html lang="{language}">
<head>
  <meta charset="utf-8">
  <title>{html.escape(source.splitlines()[0].lstrip('# ').strip())}</title>
  <style>{STYLES}</style>
</head>
<body>{body}</body>
</html>"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    HTML(string=document, base_url=str(ROOT)).write_pdf(output_path)
    print(f'Created {output_path.relative_to(ROOT)}')


def main() -> None:
    for language, (source_path, output_path) in MANUALS.items():
        build_manual(language, source_path, output_path)


if __name__ == '__main__':
    main()

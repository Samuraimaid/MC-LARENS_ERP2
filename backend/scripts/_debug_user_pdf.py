from __future__ import annotations

from pathlib import Path

from pypdf import PdfReader

pdf_path = Path(r"c:\Users\dayav\Downloads\etiquetas-DEF-TOY-001 (1).pdf")
reader = PdfReader(str(pdf_path))
page = reader.pages[0]
out = Path(__file__).resolve().parents[1] / "data" / "_pdf_info.txt"
out.write_text(
    "\n".join(
        [
            f"mediabox={page.mediabox}",
            f"rotation={page.get('/Rotate')}",
            f"pages={len(reader.pages)}",
        ]
    ),
    encoding="utf-8",
)
print(out)
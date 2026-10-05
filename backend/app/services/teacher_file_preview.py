"""Read DOCX content without executing document code or exposing external links."""
from zipfile import ZipFile, BadZipFile
from xml.etree import ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def docx_preview(path):
    try:
        with ZipFile(path) as archive:
            info = archive.getinfo("word/document.xml")
            if info.file_size > 20 * 1024 * 1024:
                raise ValueError("Documento demasiado grande para la vista previa.")
            xml = archive.read(info)
        if b"<!DOCTYPE" in xml or b"<!ENTITY" in xml:
            raise ValueError("Documento no válido.")
        root = ET.fromstring(xml)
        body = root.find(W + "body")
        if body is None:
            raise ValueError("Documento sin contenido.")
    except (BadZipFile, KeyError, ET.ParseError, OSError) as exc:
        raise ValueError("No se puede leer este documento Word.") from exc

    def paragraph(node):
        style = node.find("./" + W + "pPr/" + W + "pStyle")
        style_name = style.get(W + "val", "") if style is not None else ""
        heading = next((n for n in range(1, 7) if style_name.lower() in (f"heading{n}", f"titulo{n}", f"título{n}")), 0)
        runs = []
        for run in node.iter(W + "r"):
            text = "".join(item.text or "" if item.tag == W + "t" else "\n" if item.tag == W + "br" else "\t" if item.tag == W + "tab" else "" for item in run)
            if not text:
                continue
            props = run.find(W + "rPr")
            def active(name):
                prop = props.find(W + name) if props is not None else None
                return prop is not None and prop.get(W + "val", "true") not in ("0", "false", "off", "none")
            runs.append({"text": text, "bold": active("b"), "italic": active("i"), "underline": active("u")})
        return {"type": "paragraph", "heading": heading, "list": node.find("./" + W + "pPr/" + W + "numPr") is not None, "runs": runs}

    blocks = []
    for node in body:
        if node.tag == W + "p":
            blocks.append(paragraph(node))
        elif node.tag == W + "tbl":
            blocks.append({"type": "table", "rows": [[ [paragraph(p) for p in cell.findall(W + "p")] for cell in row.findall(W + "tc")] for row in node.findall(W + "tr")]})
    return {"format": "docx", "blocks": blocks}

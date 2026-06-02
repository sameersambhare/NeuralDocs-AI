import os
import tempfile
import logging
from io import BytesIO
from functools import lru_cache

from fastapi import UploadFile
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document

from core.config import get_settings
from services.text_normalization import clean_text


logger = logging.getLogger(__name__)


async def load_pdf(file: UploadFile) -> list[Document]:
    settings = get_settings()

    if file.content_type != "application/pdf" or not file.filename.lower().endswith(".pdf"):
        raise ValueError(f"{file.filename} is not a PDF file")

    data = await file.read()
    max_bytes = settings.max_file_size_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise ValueError(f"{file.filename} is larger than {settings.max_file_size_mb}MB")

    temp_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            temp_file.write(data)
            temp_path = temp_file.name

        loader = PyPDFLoader(temp_path)
        documents = loader.load()

        _normalize_metadata(documents, file.filename)

        if settings.ocr_enabled:
            documents = _apply_ocr_fallback(temp_path, documents, file.filename)

        if settings.table_extraction_enabled:
            documents.extend(_extract_tables(temp_path, file.filename))

        return documents
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


def _normalize_metadata(documents: list[Document], filename: str) -> None:
    for doc in documents:
        doc.page_content = clean_text(doc.page_content)
        doc.metadata["filename"] = clean_text(filename)
        doc.metadata["extraction_method"] = "text"
        doc.metadata["content_type"] = "text"
        if "page" in doc.metadata:
            doc.metadata["page"] = int(doc.metadata["page"]) + 1


def _apply_ocr_fallback(
    pdf_path: str,
    documents: list[Document],
    filename: str,
) -> list[Document]:
    settings = get_settings()
    low_text_pages = _find_low_text_pages(pdf_path, documents)

    if not low_text_pages:
        return documents

    ocr_text_by_page = _ocr_pdf_pages(pdf_path, low_text_pages)
    by_page = {
        int(doc.metadata.get("page", index + 1)): doc
        for index, doc in enumerate(documents)
    }

    for page, ocr_text in ocr_text_by_page.items():
        if not ocr_text.strip():
            continue

        if page in by_page:
            by_page[page].page_content = clean_text(ocr_text)
            by_page[page].metadata["extraction_method"] = "ocr"
        else:
            documents.append(
                Document(
                    page_content=clean_text(ocr_text),
                    metadata={
                        "filename": clean_text(filename),
                        "page": page,
                        "extraction_method": "ocr",
                        "content_type": "text",
                    },
                )
            )

    return documents


def _find_low_text_pages(pdf_path: str, documents: list[Document]) -> set[int]:
    settings = get_settings()

    if not documents:
        return set(range(1, _get_pdf_page_count(pdf_path) + 1))

    return {
        int(doc.metadata.get("page", index + 1))
        for index, doc in enumerate(documents)
        if len(doc.page_content.strip()) < settings.ocr_min_text_chars
    }


def _get_pdf_page_count(pdf_path: str) -> int:
    try:
        import fitz
    except ImportError as exc:
        raise RuntimeError(
            "OCR dependencies are missing. Install backend requirements, including PyMuPDF."
        ) from exc

    with fitz.open(pdf_path) as pdf:
        return pdf.page_count


def _ocr_pdf_pages(pdf_path: str, pages: set[int]) -> dict[int, str]:
    settings = get_settings()

    try:
        import fitz
        import numpy as np
        from PIL import Image
    except ImportError as exc:
        raise RuntimeError(
            "OCR dependencies are missing. Install backend requirements, including "
            "PyMuPDF, EasyOCR, Pillow, and numpy."
        ) from exc

    results: dict[int, str] = {}
    zoom = settings.ocr_dpi / 72
    matrix = fitz.Matrix(zoom, zoom)

    reader = _get_easyocr_reader(settings.easyocr_languages, settings.easyocr_gpu)
    with fitz.open(pdf_path) as pdf:
        for page_number in sorted(pages):
            if page_number < 1 or page_number > pdf.page_count:
                continue

            page = pdf.load_page(page_number - 1)
            pixmap = page.get_pixmap(matrix=matrix, alpha=False)
            image = Image.open(BytesIO(pixmap.tobytes("png"))).convert("RGB")
            ocr_lines = reader.readtext(np.array(image), detail=0, paragraph=True)
            results[page_number] = "\n".join(line.strip() for line in ocr_lines if line.strip())

    return results


@lru_cache
def _get_easyocr_reader(languages: str, gpu: bool):
    try:
        import easyocr
    except ImportError as exc:
        raise RuntimeError(
            "EasyOCR is missing. Install backend requirements, including easyocr."
        ) from exc

    language_list = [language.strip() for language in languages.split(",") if language.strip()]
    return easyocr.Reader(language_list or ["en"], gpu=gpu)


def _extract_tables(pdf_path: str, filename: str) -> list[Document]:
    try:
        import pdfplumber
    except ImportError as exc:
        logger.warning(
            "Skipping table extraction because pdfplumber is not installed: %s",
            exc,
        )
        return []

    documents: list[Document] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page_index, page in enumerate(pdf.pages, start=1):
            for table_index, table in enumerate(page.extract_tables(), start=1):
                table_text = _table_to_markdown(table)
                if not table_text:
                    continue

                documents.append(
                    Document(
                        page_content=clean_text(table_text),
                        metadata={
                            "filename": clean_text(filename),
                            "page": page_index,
                            "table_index": table_index,
                            "extraction_method": "table",
                            "content_type": "table",
                        },
                    )
                )

    return documents


def _table_to_markdown(table: list[list[str | None]]) -> str:
    rows = [
        [clean_text(str(cell)) if cell is not None else "" for cell in row]
        for row in table
        if row and any(cell for cell in row)
    ]
    if not rows:
        return ""

    width = max(len(row) for row in rows)
    normalized = [row + [""] * (width - len(row)) for row in rows]
    header = normalized[0]
    separator = ["---"] * width
    body = normalized[1:]

    markdown_rows = [header, separator, *body]
    return "\n".join(
        "| " + " | ".join(cell.replace("\n", " ") for cell in row) + " |"
        for row in markdown_rows
    )

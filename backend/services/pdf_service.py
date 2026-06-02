import os
import tempfile

from fastapi import UploadFile
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document

from core.config import get_settings


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

        for doc in documents:
            doc.metadata["filename"] = file.filename
            if "page" in doc.metadata:
                doc.metadata["page"] = int(doc.metadata["page"]) + 1

        return documents
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

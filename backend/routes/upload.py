import logging

from fastapi import APIRouter, File, HTTPException, UploadFile

from core.config import get_settings
from models.responses import UploadResponse
from services.chunking_service import chunk_documents
from services.embedding_service import embed_documents
from services.pdf_service import load_pdf
from services.vector_store_service import save_chunks

router = APIRouter(prefix="/api", tags=["upload"])
logger = logging.getLogger(__name__)


@router.post("/upload", response_model=UploadResponse)
async def upload_pdfs(files: list[UploadFile] = File(...)) -> UploadResponse:
    settings = get_settings()

    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    if len(files) > settings.max_files:
        raise HTTPException(status_code=400, detail=f"Maximum {settings.max_files} files allowed")

    documents = []
    for file in files:
        try:
            documents.extend(await load_pdf(file))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        chunks = chunk_documents(documents)
        texts = [chunk.page_content for chunk in chunks]
        embeddings = embed_documents(texts)

        rows = []
        for chunk, embedding in zip(chunks, embeddings):
            rows.append(
                {
                    "content": chunk.page_content,
                    "embedding": embedding,
                    "filename": chunk.metadata.get("filename"),
                    "page": chunk.metadata.get("page"),
                }
            )

        saved_count = save_chunks(rows)
    except Exception as exc:
        logger.exception("Upload ingestion failed")
        raise HTTPException(
            status_code=500,
            detail=f"Upload ingestion failed: {exc}",
        ) from exc

    return UploadResponse(
        success=True,
        documents_processed=len(files),
        chunks_created=saved_count,
    )

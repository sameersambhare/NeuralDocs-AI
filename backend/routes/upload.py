import logging

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from core.config import get_settings
from models.responses import UploadResponse, WorkspaceDeleteResponse, WorkspaceFile
from services.chunking_service import chunk_documents
from services.embedding_service import embed_documents
from services.pdf_service import load_pdf
from services.text_normalization import clean_text
from services.vector_store_service import (
    delete_workspace_file,
    get_workspace_files,
    save_chunks,
)

router = APIRouter(prefix="/api", tags=["upload"])
logger = logging.getLogger(__name__)


@router.post("/upload", response_model=UploadResponse)
async def upload_pdfs(
    files: list[UploadFile] = File(...),
    workspace_id: str = Form("default"),
) -> UploadResponse:
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
        texts = [clean_text(chunk.page_content) for chunk in chunks]
        embeddings = embed_documents(texts)

        rows = []
        for chunk, embedding in zip(chunks, embeddings):
            rows.append(
                {
                    "content": clean_text(chunk.page_content),
                    "embedding": embedding,
                    "filename": clean_text(chunk.metadata.get("filename")),
                    "page": chunk.metadata.get("page"),
                    "workspace_id": workspace_id,
                    "content_type": clean_text(chunk.metadata.get("content_type", "text")),
                    "extraction_method": clean_text(
                        chunk.metadata.get("extraction_method", "text")
                    ),
                    "table_index": chunk.metadata.get("table_index"),
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


@router.get("/workspaces/{workspace_id}/files", response_model=list[WorkspaceFile])
def list_workspace_files(workspace_id: str) -> list[WorkspaceFile]:
    return [WorkspaceFile(**item) for item in get_workspace_files(workspace_id)]


@router.delete("/workspaces/{workspace_id}/files", response_model=WorkspaceDeleteResponse)
def remove_workspace_file(
    workspace_id: str,
    filename: str = Query(..., min_length=1),
) -> WorkspaceDeleteResponse:
    cleaned_filename = clean_text(filename)
    if not cleaned_filename:
        raise HTTPException(status_code=400, detail="filename is required")

    deleted_chunks = delete_workspace_file(workspace_id, cleaned_filename)
    if deleted_chunks == 0:
        raise HTTPException(status_code=404, detail="File not found in workspace")

    return WorkspaceDeleteResponse(
        success=True,
        filename=cleaned_filename,
        deleted_chunks=deleted_chunks,
    )

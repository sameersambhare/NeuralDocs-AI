from pydantic import BaseModel, Field


class UploadResponse(BaseModel):
    success: bool
    documents_processed: int
    chunks_created: int


class WorkspaceFile(BaseModel):
    filename: str
    chunk_count: int
    last_page: int | None = None
    content_types: list[str] = Field(default_factory=list)


class WorkspaceDeleteResponse(BaseModel):
    success: bool
    filename: str
    deleted_chunks: int


class Source(BaseModel):
    id: int | str | None = None
    filename: str
    page: int | None = None
    workspace_id: str | None = None
    content: str
    snippet: str
    content_type: str = "text"
    extraction_method: str | None = None
    table_index: int | None = None


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]

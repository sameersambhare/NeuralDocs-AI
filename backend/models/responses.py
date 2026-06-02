from pydantic import BaseModel


class UploadResponse(BaseModel):
    success: bool
    documents_processed: int
    chunks_created: int


class Source(BaseModel):
    filename: str
    page: int | None = None


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]

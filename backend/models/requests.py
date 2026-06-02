from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    workspace_id: str | None = None
    filenames: list[str] | None = None
    session_id: str | None = None

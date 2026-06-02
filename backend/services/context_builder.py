from typing import Any


def build_context(chunks: list[dict[str, Any]]) -> str:
    parts = []
    for chunk in chunks:
        filename = chunk.get("filename", "unknown")
        page = chunk.get("page")
        workspace_id = chunk.get("workspace_id", "default")
        content_type = chunk.get("content_type", "text")
        extraction_method = chunk.get("extraction_method", "text")
        table_index = chunk.get("table_index")
        content = chunk.get("content", "").strip()
        table_line = f"\nTable: {table_index}" if table_index else ""
        parts.append(
            "Workspace: "
            f"{workspace_id}\nFilename: {filename}\nPage: {page}{table_line}\n"
            f"Content type: {content_type}\nExtraction: {extraction_method}\n\n{content}"
        )
    return "\n\n---\n\n".join(parts)


def build_sources(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen = set()
    sources = []

    for chunk in chunks:
        source = (
            chunk.get("id"),
            chunk.get("workspace_id"),
            chunk.get("filename"),
            chunk.get("page"),
            chunk.get("table_index"),
        )
        if source in seen:
            continue
        seen.add(source)
        content = (chunk.get("content") or "").strip()
        sources.append(
            {
                "id": source[0],
                "workspace_id": source[1],
                "filename": source[2] or "unknown",
                "page": source[3],
                "content": content,
                "snippet": _build_snippet(content),
                "content_type": chunk.get("content_type", "text"),
                "extraction_method": chunk.get("extraction_method"),
                "table_index": source[4],
            }
        )

    return sources


def _build_snippet(content: str, limit: int = 280) -> str:
    content = " ".join(content.split())
    if len(content) <= limit:
        return content
    return f"{content[:limit].rsplit(' ', 1)[0]}..."

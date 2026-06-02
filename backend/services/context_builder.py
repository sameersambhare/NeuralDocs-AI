from typing import Any


def build_context(chunks: list[dict[str, Any]]) -> str:
    parts = []
    for chunk in chunks:
        filename = chunk.get("filename", "unknown")
        page = chunk.get("page")
        content = chunk.get("content", "").strip()
        parts.append(f"Filename: {filename}\nPage: {page}\n\n{content}")
    return "\n\n---\n\n".join(parts)


def build_sources(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen = set()
    sources = []

    for chunk in chunks:
        source = (chunk.get("filename"), chunk.get("page"))
        if source in seen:
            continue
        seen.add(source)
        sources.append({"filename": source[0] or "unknown", "page": source[1]})

    return sources

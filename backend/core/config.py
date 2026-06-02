from functools import lru_cache
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str
    supabase_key: str = Field(
        validation_alias=AliasChoices(
            "SUPABASE_SERVICE_ROLE_KEY",
            "SUPABASE_KEY",
            "SUPABASE_API_KEY",
        )
    )
    anthropic_api_key: str = Field(validation_alias=AliasChoices("ANTHROPIC_API_KEY"))

    supabase_table: str = "document_chunks"
    anthropic_model: str = "claude-haiku-4-5-20251001"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"

    chunk_size: int = 1000
    chunk_overlap: int = 200
    vector_k: int = 10
    bm25_k: int = 10
    final_k: int = 5

    max_files: int = 5
    max_file_size_mb: int = 10

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()

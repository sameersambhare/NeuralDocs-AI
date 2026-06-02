import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.chat import router as chat_router
from routes.upload import router as upload_router


app = FastAPI(title="NeuralDocs AI Backend")

default_origins = {
    "http://localhost:3000",
    "http://127.0.0.1:3000",
}
configured_origins = {
    origin.strip().rstrip("/")
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
}
frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
if frontend_url:
    configured_origins.add(frontend_url)

allow_origins = sorted(default_origins | configured_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router)
app.include_router(chat_router)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": "NeuralDocs AI Backend",
        "status": "ok",
        "health": "/health",
    }


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}

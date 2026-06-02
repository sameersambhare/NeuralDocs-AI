# NeuralDocs AI

> **Ask questions. Get answers. Traced back to the source.**

NeuralDocs AI is a document question-answering system powered by Retrieval-Augmented Generation (RAG). Upload your PDF collections, ask questions in natural language, and receive grounded answers with citations — no hallucinations, no guesswork.

---

## What It Does

Large PDF collections are hard to search manually. Keyword search misses semantically related content. And LLMs alone can hallucinate when they're not grounded in source material.

NeuralDocs AI solves this by combining **retrieval** and **generation**:

1. Upload PDFs into a named workspace
2. The backend extracts, chunks, and embeds the text
3. Ask a question — the system retrieves the most relevant passages
4. Claude generates a readable answer, grounded strictly in those passages
5. Source citations link back to the exact filename and page

---

## Architecture Overview

```
User → Next.js Frontend → Next.js API Routes → FastAPI Backend
                                                    ├── PDF Parsing + OCR + Chunking
                                                    ├── Embedding (HuggingFace MiniLM)
                                                    ├── Hybrid Retrieval (Vector + BM25)
                                                    └── Claude (Answer Generation)
                                                              ↕
                                                    Supabase + pgvector (Storage)
```

### Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (React) |
| Backend | FastAPI (Python) |
| Database | Supabase (PostgreSQL + pgvector) |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` via HuggingFace |
| Retrieval | Hybrid: Vector Search + BM25 + Reciprocal Rank Fusion |
| Generation | Anthropic Claude |
| OCR | EasyOCR |
| PDF Parsing | PyPDFLoader + pdfplumber |

---

## Repository Layout

```
NeuralDocs AI/
├── backend/
│   ├── app.py                   # FastAPI entry point
│   ├── requirements.txt
│   ├── .env.example
│   ├── supabase_schema.sql
│   ├── core/                    # Settings, prompt templates
│   ├── database/                # Supabase client
│   ├── models/                  # Request/response schemas
│   ├── routes/                  # HTTP endpoints
│   └── services/                # PDF, chunking, embeddings, retrieval, LLM, memory
└── frontend/
    ├── app/                     # Pages + API proxy routes
    ├── components/              # Chat UI, citations, file preview, shadcn primitives
    ├── hooks/                   # Shared React hooks
    ├── lib/                     # Utility and integration helpers
    ├── types/
    └── __tests__/
```

---

## How It Works

### Upload Pipeline

When a user uploads PDFs:

1. Frontend validates file type and sends `multipart/form-data` to `/api/ingest`
2. Next.js proxies the request to FastAPI `/api/upload`
3. FastAPI validates count, type, and file size
4. Each PDF is processed through three parallel extractors:
   - **PyPDFLoader** — primary text extraction
   - **EasyOCR** — fallback for scanned/image pages
   - **pdfplumber** — table extraction
5. Extracted text is chunked into passages
6. Each chunk is embedded using `all-MiniLM-L6-v2`
7. Chunks and metadata are saved to Supabase

### Question Answering Pipeline

When a user asks a question:

1. Frontend sends the question, workspace ID, selected filenames, and session ID
2. Backend loads recent conversation history (in-memory)
3. If the question is a follow-up, the backend rewrites it for retrieval context
4. **Hybrid retrieval** runs in parallel:
   - **Vector search** via Supabase `pgvector` (semantic similarity)
   - **BM25** (lexical overlap for exact terms, codes, IDs)
5. Results are fused using **Reciprocal Rank Fusion (RRF)**
6. A context block is assembled from the top-ranked chunks
7. Claude generates an answer using *only* the retrieved context
8. The answer streams back to the browser as Server-Sent Events (SSE)
9. Source citations are appended to the response

---

## Why Hybrid Retrieval

Each retrieval method has blind spots:

- **Vector search** is good at meaning, but can miss exact names, error codes, or rare terms
- **BM25** is good at exact matches, but can miss paraphrases or conceptual questions

Examples:
- *"What is the exact error code in the schema?"* → BM25 wins (literal match)
- *"How are scanned pages handled?"* → Vector search wins (semantic match)

Combining both improves recall and ranking quality across the full range of real-world questions.

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- A Supabase project with `pgvector` enabled
- An Anthropic API key

### Backend Setup

```bash
cd backend
cp .env.example .env
# Fill in: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY

pip install -r requirements.txt
uvicorn app:app --reload
```

Confirm the backend is running:

```bash
curl http://localhost:8000/health
```

Apply the database schema in your Supabase SQL editor:

```bash
# Run contents of supabase_schema.sql in the Supabase dashboard
```

### Frontend Setup

```bash
cd frontend
cp .env.example .env.local
# Fill in: BACKEND_URL=http://localhost:8000

npm install
npm run dev
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `BACKEND_URL` | URL of the running FastAPI backend |

---

## Deployment

### Frontend → Vercel

1. Set `BACKEND_URL` in Vercel environment variables
2. Connect your repo and deploy

### Backend → Render (or any Python host)

1. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`
2. Start command: `uvicorn app:app --host 0.0.0.0 --port 8000`
3. Confirm `/health` endpoint responds

### Database → Supabase

- Enable the `pgvector` extension
- Run `supabase_schema.sql` to create the `document_chunks` table and `match_document_chunks` RPC

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/upload` | Ingest PDFs into a workspace |
| `POST` | `/api/chat/stream` | Stream an answer to a question |
| `GET` | `/api/workspaces/{id}/files` | List files in a workspace |
| `DELETE` | `/api/workspaces/{id}/files/{filename}` | Remove a file's indexed chunks |
| `GET` | `/health` | Health check |

---

## Error Handling

| Failure | Cause | Handling |
|---|---|---|
| Supabase connection | Invalid credentials, schema mismatch | Falls back to local cosine similarity; returns HTTP 500 |
| Claude API | Missing key, model name, outage | Tries fallback model; returns HTTP 500 |
| OCR | Missing dependencies, corrupt PDF | Raises runtime error with readable message |
| Embeddings | Model download failure, invalid input | Upload fails before persistence; text sanitized first |
| Upload validation | Too many files, wrong type, oversized | Returns HTTP 400 with clear message; frontend shows toast |

---

## Known Limitations

- Conversation memory is **in-process only** — it does not survive backend restarts
- The system indexes **text chunks**, not the original PDF files; the raw PDFs are not stored
- Workspace file deletion removes indexed rows for that filename within that workspace

---

## Extension Points

| Feature | Files to Modify |
|---|---|
| Add reranking | `hybrid_retrieval_service.py`, `rrf_service.py`, new `rerank_service.py` |
| Multi-document workspace metadata | `routes/upload.py`, `services/vector_store_service.py`, `frontend/app/page.tsx` |
| User authentication | Frontend auth flow, backend middleware, route authorization |
| Additional LLM providers | `services/llm_service.py` — abstract behind a common interface |
| Evaluation dashboard | New frontend pages, retrieval logging, optional metrics table |

---

## Rebuild Order (Mental Model)

If you're rebuilding from scratch, follow this sequence:

1. PDF ingestion
2. Text chunking
3. Chunk + metadata storage
4. Embeddings
5. Vector search
6. BM25
7. RRF fusion
8. Prompt context assembly
9. Claude integration
10. Citation rendering
11. Workspace management
12. OCR + table extraction

---

## License

See [LICENSE](./LICENSE.md) for details.

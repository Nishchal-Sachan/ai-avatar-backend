# AI Voice Agent Backend

A **production-oriented Express API** that powers voice-first interactions over a **retrieval-augmented knowledge base**. The system closes the loop from **spoken intent** to **grounded natural language**, then back to **synthesized speech**—while keeping the same RAG stack usable from plain text clients.

**Why voice + RAG:** Speech lowers friction for end users, but raw LLMs hallucinate and drift from organizational truth. Coupling **automatic speech recognition (ASR)** with **semantic retrieval** constrains generation to ingested documents (per **avatar / tenant**), so answers stay **traceable to source material** while remaining conversational when delivered via **TTS**.

---

## System architecture

### High-level design

The backend is structured as a **layered monolith**: HTTP adapters (controllers + routes) delegate to **stateless services** that encapsulate provider SDKs and domain logic. Long-lived concerns (auth, validation, rate limits, logging) sit in **middleware**; **orchestration** for the primary user journey lives in **`askService`** (STT → language handling → RAG+LLM → TTS → persistence).

No message broker is required for the default path: each `/ask` request is an **async pipeline** of awaited I/O steps. That trade-off favors **operational simplicity** and predictable debugging; horizontal scale is achieved by **scaling stateless app instances** and keeping **Pinecone + MongoDB** as shared backends.

### End-to-end flow (voice)

```
┌─────────┐   audio    ┌──────────┐   text     ┌──────────────────────────────────────┐
│ Client  │ ─────────► │ Deepgram │ ─────────► │ askService                          │
│         │            │   STT    │            │  • optional NL preprocessing        │
└─────────┘            └──────────┘            │  • RAG: embed → Pinecone → context    │
                                               │  • LLM: Groq (Llama 3.3)            │
                                               │  • Deepgram TTS → WAV on disk       │
                                               └──────────────────────────────────────┘
                                                          │
                        ┌─────────────────────────────────┼─────────────────────────┐
                        ▼                                 ▼                         ▼
                 ┌────────────┐                  ┌──────────────┐           ┌──────────┐
                 │ Pinecone   │                  │ Conversation │           │ Static   │
                 │ (vectors)  │                  │ store (Mongo)│           │ /uploads │
                 └────────────┘                  └──────────────┘           └──────────┘
```

### Component responsibilities

| Component | Responsibility |
|-----------|----------------|
| **Routes / controllers** | Auth, multipart parsing, Joi validation, HTTP status mapping |
| **`askService`** | Pipeline orchestration, structured logging, degraded-mode policy (e.g. safe copy if R+G fails; `audioUrl: null` if TTS fails) |
| **`speech.service`** | Deepgram **pre-recorded** transcription; filesystem hygiene; `STT_FAILED` on hard errors |
| **`rag.service`** | Query embedding, **namespace-scoped** similarity search, context assembly, token budget, Groq completion (`preferGroq` on ask path) |
| **`embedding.service`** | Hugging Face inference → vectors; Pinecone upsert/query abstraction |
| **`tts.service`** | Deepgram **Aura** synthesis; persist `.wav` under `uploads/audio/`; **absolute URL** via `BASE_URL` |
| **`conversationService`** | Persist Q/A metadata including optional `audioUrl` |
| **`middleware`** | JWT, roles, rate limit (`/api/v1`), CORS, Helmet, request IDs, global error envelope |

### Async orchestration

Each stage **`await`s** the previous: STT must finish before embedding the question; retrieval must finish before the LLM sees context; TTS runs after the final user-facing string is known. **Latency is additive** along the chain; engineering mitigations include bounded `topK`, context **truncation** to a token budget, and **Groq-only** routing on the ask pipeline for consistent provider behavior.

---

## Architecture diagram (text)

```
                    PDF upload (creator)
                           │
                           ▼
              ┌────────────────────────┐
              │ Parse · Chunk · Embed  │───► Pinecone (metadata: avatarId, documentId, …)
              └────────────────────────┘

User question (text or audio multipart)
           │
           ├─ audio? ──► Deepgram STT ──► transcript
           │
           ▼
    Language detect / translate (optional)
           │
           ▼
    Embed question ──► Pinecone top-K ──► context block
           │
           ▼
    Groq chat (Llama 3.3) with system + context + question
           │
           ├─ failure? ──► safe user-visible message (orchestrator)
           │
           ▼
    Translate answer to user language (optional)
           │
           ▼
    Deepgram TTS ──► writes uploads/audio/*.wav
           │
           ▼
    JSON: { textResponse, audioUrl, detectedLanguage, responseLanguage }
```

---

## Detailed workflow

### 1. PDF ingestion

Creators upload a **PDF** (validated MIME, size capped per multer config) with metadata (`title`, `avatarId`). The document is stored and linked for later chunk association.

### 2. Chunking & embeddings

Text is **segmented into chunks** suitable for retrieval. Each chunk is passed through the **embedding model** (Hugging Face `sentence-transformers/all-MiniLM-L6-v2`, **384-dim**—aligned with the Pinecone index).

### 3. Storage in Pinecone

Vectors are **upserted** with **filterable metadata** (e.g. `avatarId`, `documentId`) so queries retrieve **only** knowledge relevant to the active avatar.

### 4. Query flow (`/ask`)

Authenticated clients send **JSON `{ text, avatarId, … }`** or **multipart** with optional **`audio`** field. **avatarId** is mandatory— it drives the retrieval namespace.

### 5. Retrieval

The user utterance (post-STT if needed) is embedded; **top-K** neighbors are fetched from Pinecone, **hydrated** into text, optionally **truncated** to respect context limits.

### 6. LLM processing

**Groq** (default model path: **LLaMA 3.3**, e.g. `llama-3.3-70b-versatile` in code) completes off a **district-collector-style** system prompt and a user message that concatenates **context + question**. Recent turns may be pulled from Mongo for light **conversational continuity**.

### 7. TTS generation

The final answer string is sent to **Deepgram Aura**; binary audio is written to **`uploads/audio/`** with a unique name. **`BASE_URL`** + `/uploads/...` yields a **publicly dereferenceable** URL (Express static).

### 8. Final response

The API returns **structured JSON**: human-readable **`textResponse`**, optional **`audioUrl`**, and language fields. **TTS failures** do not fail the HTTP request—**`audioUrl` is null** while text still returns.

---

## Module breakdown

```
├── app.js / server.js          # Express app, lifecycle, DB connect
├── config/                     # env validation, logger, DB, OpenAI client (legacy/other)
├── controllers/                # Thin HTTP handlers
├── middleware/                 # auth, upload, validate, rateLimit, errors
├── routes/                     # Versioned under /api/v1
├── services/
│   ├── askService.js           # Primary orchestrator (voice + text)
│   ├── rag.service.js          # Retrieval + LLM call site
│   ├── llm.service.js          # Groq (with optional OpenAI elsewhere)
│   ├── speech.service.js       # Deepgram STT
│   ├── tts.service.js          # Deepgram TTS
│   ├── embedding.service.js    # HF embeddings + vector I/O
│   ├── translation.service.js  # Optional multilingual path
│   └── conversationService.js  # Persistence helpers
├── services/embedding/         # Chunk store / Pinecone adapters
├── uploads/                    # PDFs + generated audio (audio served statically)
└── utils/                      # AppError, async helpers
```

**Integrations**

- **Deepgram** — `@deepgram/sdk`: `listen.v1.media.transcribeFile` (STT), `speak.v1.audio.generate` (TTS).
- **Groq** — HTTPS OpenAI-compatible completions API.
- **Hugging Face** — embedding inference for query and document vectors.
- **Pinecone** — `@pinecone-database/pinecone` for hosted vector search.

---

## Engineering challenges & solutions

| Challenge | Approach |
|-----------|----------|
| **Multi-step async orchestration** | Single `async` pipeline in `askService` with clear step logging (`requestId`); no shared mutable singleton state for STT/TTS results. |
| **End-to-end latency** | STT + embed + vector + LLM + TTS are sequential; mitigated by modest `topK`, context truncation, and provider timeouts. |
| **Syncing text + audio** | One canonical **`textResponse`**; TTS consumes that exact string so lip-sync / client playback aligns with captions. |
| **Partial failure** | STT → **`STT_FAILED`** (hard); RAG/LLM → **safe message** in body; TTS → **`audioUrl: null`**. |
| **Tenant isolation** | Retrieval filtered by **avatar / namespace** metadata in Pinecone. |
| **Deploy static audio** | `BASE_URL` + `express.static('/uploads')` so clients load WAV without proxying binary through app logic. |

---

## API design

Base path: **`/api/v1`** (subject to `apiLimiter`).

### Knowledge ingestion

| Method | Path | Notes |
|--------|------|--------|
| `POST` | **`/documents`** | Creator role. Multipart `file` (PDF), `title`, optional `avatarId`. |
| `DELETE` | **`/documents/:id`** | Creator; uploader-only deletion. |

### Primary voice / RAG pipeline

| Method | Path | Notes |
|--------|------|--------|
| `POST` | **`/ask`** | **Main pipeline.** Body or multipart: `avatarId` **required**; `text` and/or `audio`; optional `temperature`, `maxTokens`, `topK`. |

**Example success shape:**

```json
{
  "success": true,
  "data": {
    "textResponse": "… grounded answer …",
    "audioUrl": "https://your-host.example/uploads/audio/tts-….wav",
    "detectedLanguage": "en",
    "responseLanguage": "en"
  }
}
```

### Standalone audio I/O (authenticated)

| Method | Path | Notes |
|--------|------|--------|
| `POST` | **`/audio/speech-to-text`** | Multipart audio → transcript. |
| `POST` | **`/audio/text-to-speech`** | JSON → stored audio URL. |
| `POST` | **`/audio/synthesize/stream`** | Streaming TTS body. |
| `POST` | **`/speech-to-text`** | Alternate STT route (alias stack). |
| `POST` | **`/text-to-speech`** | Alternate TTS route. |

### Health

- **`GET /health`** (root) — process health.
- **`GET /api/v1/health`** — router echo (if enabled in `routes/index.js`).

Errors generally follow: **`{ success: false, error: { code, message } }`** via centralized middleware (no stack traces on validation failures).

---

## Performance considerations

- **Latency budget** grows linearly with STT, embedding, Pinecone round-trip, Groq TTFT, and TTS synthesis—**profile in production** with `requestId`-correlated logs.
- **Chunk retrieval**: tune **`topK`** and **embedding quality** before scaling hardware; avoid dumping entire PDFs into prompt context.
- **Scalability**: stateless Node replicas behind a load balancer; **Pinecone** and **MongoDB** handle shared state; **local disk `uploads/`** either requires shared volume or migration to **object storage** (S3 + signed URLs) at scale.
- **Cold starts** (serverless / Render free tier): first request after idle may spike latency—warmup health checks help.

---

## Production considerations

- **Error handling** — `AppError` with **machine-readable `code`** (`STT_FAILED`, `VALIDATION_ERROR`, …); global middleware maps exceptions to HTTP semantics.
- **Logging** — Structured logging (e.g. Winston) around STT, RAG chunk counts, LLM completion, TTS paths; **never log raw API keys**.
- **Retries** — Groq path implements **bounded retries** on rate-limit / transient statuses.
- **Rate limiting** — `express-rate-limit` on **`/api/v1`** (`RATE_LIMIT_MAX`).
- **Security** — Helmet, JWT auth, role-based document access, CORS configuration, `trust proxy` for reverse proxies.
- **Configuration** — Central `config/env.js` (Joi) validates critical env at boot.

---

## Future improvements

- **Streaming** — Stream LLM tokens and optionally **streaming TTS** (`WebSocket` / chunked HTTP) for perceived latency wins.
- **Conversation memory** — Longer structured memory, summarization, and explicit **user consent** boundaries.
- **Real-time STT** — Deepgram **live** streams for duplex agentsinstead of upload-then-transcribe.
- **Object storage** — Replace local `uploads/` with **S3-compatible** storage + CDN.
- **Observability** — OpenTelemetry traces across STT → RAG → LLM → TTS spans.
- **Evaluation** — Offline RAG metrics (recall@k, answer faithfulness) per avatar.

---

## Setup

### Prerequisites

- **Node.js 20.x** (see `package.json` engines)
- **MongoDB**
- Accounts / keys: **Deepgram**, **Groq**, **Hugging Face Inference**, **Pinecone**

### Installation

```bash
git clone <repository-url>
cd ai-avatar-backend
npm install
cp .env.example .env
# Edit .env — all required keys (see below)
npm run dev
# or
npm start
```

### Environment variables

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | Mongo connection string |
| `JWT_SECRET` | Signing secret (min 32 chars in validation) |
| `GROQ_API_KEY` | LLM (Groq) |
| `HF_API_KEY` | Embedding inference |
| `DEEPGRAM_API_KEY` | STT + TTS |
| `PINECONE_API_KEY` / `PINECONE_INDEX` | Vector DB |
| `BASE_URL` | **Public origin** for absolute TTS URLs (no trailing slash) |
| `PORT`, `NODE_ENV`, `LOG_LEVEL`, `RATE_LIMIT_MAX`, `CORS_ORIGIN` | Operational tuning |

Pinecone index should match **384 dimensions** and support metadata filters used for **avatar-scoped** retrieval (see `.env.example` comments).

### Running

- **Development:** `npm run dev` (watch mode)
- **Production:** `npm start` behind **HTTPS** termination (nginx, Render, etc.)

---

## Key takeaways

1. **Voice is a transport layer**—the **trust boundary** for factual answers is still **retrieval + citation-oriented prompting**, not the modality.
2. **Orchestration clarity beats clever abstractions** for small teams: one explicit pipeline (`askService`) is easier to operate than scattered triggers.
3. **Degrade gracefully**: keep **text** authoritative; treat **audio** as an enhancement so clients never deadlock on TTS outages.
4. **Multitenancy belongs in retrieval metadata**—namespaces normalize **“which knowledge base”** independent of embeddings math.

---

## License

ISC (see `package.json`).

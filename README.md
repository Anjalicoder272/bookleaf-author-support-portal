# BookLeaf Author Support & Communication Portal

An author portal and an internal support desk for BookLeaf Publishing. Authors see their books and
royalties and raise support tickets; the operations team works a prioritised queue where AI classifies
each ticket, scores its urgency and drafts a reply grounded in BookLeaf's own policies.

- **Live demo:** _frontend URL_ · **API docs:** _backend URL_/api/docs/
- **Write-up:** [WRITEUP.md](WRITEUP.md)

## Test logins

| Role | Email | Password | Good for testing |
|---|---|---|---|
| Admin | admin@bookleaf.com | admin123 | Ticket queue, AI drafts, overrides |
| Author | priya.sharma@email.com | author123 | 2 published books, pending royalty |
| Author | any of the 10 authors in `docs/bookleaf_sample_data.json` | author123 | Books in production, zero royalties, below-threshold payouts |

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind | Fast to build clean, typed UI; deploys to Vercel in one step |
| Backend | Django 5.2 + Django REST Framework | Mature auth, ORM, validation, permissions and admin out of the box |
| Auth | JWT (SimpleJWT), email + password | Stateless, works cleanly across separate frontend/backend domains |
| Database | PostgreSQL (Neon) in production, SQLite locally | Relational data with clear relationships; same schema both places |
| AI | Google Gemini 3.1 Flash-Lite | See [Model choice](#model-choice) |
| Real-time | Short polling (5–10s) | See [Real-time updates](#real-time-updates) |
| API docs | OpenAPI 3 via drf-spectacular → Swagger UI at `/api/docs/` | Generated from the code, so it can't drift |

## Architecture

```
Next.js (Vercel)  ──JWT──▶  Django REST API (Render)  ──▶  PostgreSQL (Neon)
  author pages                accounts/  auth, roles, permissions
  admin pages                 books/     authors, books, royalty rules, seed command
  polling hook                tickets/   models, serializers, views, services
                              ai/        prompts, knowledge base, Gemini client, rule fallback
                                             │
                                             ▼
                                       Gemini API (key only on the server)
```

```
backend/
  config/            settings (env-driven), URLs, JSON error handler, pagination
  apps/accounts/     email-login User with author/admin role; IsAuthor / IsAdmin permissions
  apps/books/        Author, Book, royalty schedule helpers, `seed_data` command
  apps/tickets/      Ticket, TicketMessage, InternalNote; views; services.py (AI workflows); tests
  apps/ai/           knowledge_base.py, prompts.py, service.py (LLM client), fallback.py (rules)
frontend/src/
  lib/api.ts         typed API client (adds JWT, parses errors, logs out on 401)
  hooks/usePolling   visibility-aware polling
  components/        RequireRole (route guard + layout), badges, message thread
  app/               /login, /author/{books,tickets,tickets/new,tickets/[id]}, /admin/tickets[/id]
```

### Key design decisions

- **Thin views, logic in services.** `tickets/services.py` owns the AI workflows (triage, drafting,
  caching); views only validate, authorise and serialise. The LLM client (`ai/service.py`) knows
  nothing about Django models, so the provider can be swapped without touching the ticket code.
- **Data isolation by query, not by check.** Author endpoints filter every queryset by
  `request.user.author`, so another author's ticket is a 404 (ids can't even be probed), and the
  `book_id` on a new ticket is validated against the author's own books.
- **Internal notes are a separate model** that the author serializers never touch, rather than a
  flag on messages that could be forgotten in one place.
- **AI suggestions are stored next to the final values** (`ai_category` vs `category`,
  `category_overridden`). Admin overrides are never overwritten by a later AI run, and the stored
  pairs make it possible to measure classification accuracy over time.
- **One error shape everywhere:** `{"error": {"code", "message", "details?"}}` with correct 4xx codes;
  unexpected exceptions are logged and returned as a generic 500 without a stack trace.

## AI integration

### What the AI does

| Step | When | Output |
|---|---|---|
| **Triage** | Right after a ticket is created (background thread, after commit) | Category (6 classes), priority (Critical/High/Medium/Low), one-line reasoning |
| **Draft reply** | The first time an admin opens the ticket | An editable reply in BookLeaf's tone, using real numbers from the author's records |

### Prompt strategy

- **Triage prompt** (`ai/prompts.py`): category definitions plus an explicit priority rubric taken
  from the brief (e.g. ISBN errors are always at least High; months without royalty is Critical).
  Uses Gemini's **structured output** with a Pydantic schema, temperature 0 and minimal thinking,
  so the result is always valid JSON with an allowed value; it's still validated before use.
- **Draft prompt:** system prompt = role, company overview and the **tone guidelines** verbatim
  (acknowledge first, be specific, own mistakes, give timelines, end with a next step, never sound
  like an AI, never invent facts). User prompt = the **policy section for this category only**, the
  author's **actual book data** (status, ISBN, copies, royalty earned/paid/pending, last payout,
  below-threshold rollover) and today's date with the **computed next payout date**, so replies can
  say "your next payout is due by 14 Nov" instead of "soon".

### Cost awareness

- **Knowledge base is split by category** (`ai/knowledge_base.py`); each draft call sends one
  section, not the whole document.
- **Triage sends no knowledge base at all**, just the rubric, with a 200-token output cap.
- **Conversation is trimmed** to the original query plus the last 6 messages, 800 characters each.
- **Book-specific tickets send only that book's data**; general tickets send a one-line summary per book.
- **Drafts are cached on the ticket** and only regenerated when the author has replied since, or the
  admin clicks *Regenerate*. Reopening a ticket costs nothing.
- **Minimal thinking** on both calls (deep reasoning isn't needed here, and thinking tokens are billed as output).
- Measured cost: triage ≈ **370 tokens** per ticket, a draft ≈ **1,000 tokens**.
- Token usage of every call is logged (`AI triage tokens: prompt=… output=…`).

### Graceful degradation

Every provider error (missing key, timeout, HTTP 429 rate limit, 5xx, malformed output) is converted to
`AIUnavailable` and handled where it's used:

- **Ticket creation never depends on the AI.** The ticket is saved first; triage runs after commit.
- **If triage fails**, a keyword rule classifier (`ai/fallback.py`) labels the ticket so the queue
  still sorts sensibly. It's marked *(rules)* in the queue, and admins can click *Retry AI* later.
- **If drafting fails**, the admin sees "AI draft unavailable, please write manually" and the reply box
  works normally. The endpoint returns 200 with `ai_available: false`, not an error.
- All calls have a timeout (`AI_TIMEOUT_SECONDS`, default 25s) and **automatic retries with exponential backoff**
  for transient errors (429, 500, 503, 504) before falling back.

### API key security

The key lives only in the backend environment (`GEMINI_API_KEY`), is read in `settings.py`, and is never
sent to or referenced by the frontend. `.env` files are git-ignored; `.env.example` documents the variables.

### Model choice

**Gemini 3.1 Flash-Lite** (`GEMINI_MODEL`, configurable). Triage and drafting are short, well-specified
tasks, so a fast, low-cost model is the right fit: it supports schema-enforced JSON natively and handles
Indian names, ₹ amounts and Indian-English well. While testing, the larger Gemini Flash models were
frequently overloaded (503s) on the free tier, while Flash-Lite answered in about 1–5 seconds. The provider
is isolated in `ai/service.py`, so swapping to Claude Haiku or GPT-4o-mini means changing one file.

## Real-time updates

Tickets refresh by **polling** (author ticket page and admin ticket page every 5s, lists every 8–10s),
paused while the browser tab is hidden. List endpoints accept `?updated_since=<timestamp>` so a
client can fetch only what changed.

Polling over WebSockets/SSE was a deliberate trade-off: support replies don't need sub-second latency,
it works on free hosting tiers without sticky connections or a Redis channel layer, and it can't
silently drop updates on reconnect. With more traffic I'd switch to SSE (see limitations).

## API

Interactive docs: `/api/docs/`. All routes except login require `Authorization: Bearer <token>`.

| Method | Endpoint | Who | Description |
|---|---|---|---|
| POST | `/api/auth/login/` | anyone | Email + password → JWT + user profile |
| POST | `/api/auth/refresh/` | anyone | Refresh an access token |
| GET | `/api/auth/me/` | logged in | Current user |
| GET | `/api/me/books/` | author | The author's own books |
| GET | `/api/me/tickets/` | author | Own tickets (`?updated_since=` for polling) |
| POST | `/api/me/tickets/` | author | Raise a ticket; AI triage runs in the background |
| GET | `/api/me/tickets/{id}/` | author | Ticket with replies (internal notes never included) |
| POST | `/api/me/tickets/{id}/messages/` | author | Follow-up reply; reopens a resolved ticket |
| GET | `/api/admin/tickets/` | admin | Queue; filters `status`, `category`, `priority`, `assigned=me\|unassigned`, `created_after`, `created_before`, `search`, `page_size` |
| GET / PATCH | `/api/admin/tickets/{id}/` | admin | Full ticket; PATCH `status`, `category`, `priority`, `assigned_to` |
| POST | `/api/admin/tickets/{id}/assign/` | admin | Assign to me |
| POST | `/api/admin/tickets/{id}/responses/` | admin | Reply visible to the author, optional `status` |
| POST | `/api/admin/tickets/{id}/notes/` | admin | Internal note |
| GET / POST | `/api/admin/tickets/{id}/draft/` | admin | Cached AI draft / regenerate |
| POST | `/api/admin/tickets/{id}/retriage/` | admin | Re-run AI classification |

Example error:

```json
{"error": {"code": "invalid", "message": "Validation failed.",
           "details": {"book_id": ["Book not found in your account."]}}}
```

## Edge cases handled

- **Books still in production** (no MRP, no publication date): shown with a production note instead of
  ₹0 sales; the AI is told the book isn't published yet.
- **Zero royalties / never paid:** shown as ₹0 with "no payout yet"; no misleading payout dates.
- **Pending royalty below the ₹1,000 threshold** (e.g. *The Nagpur Notebooks*, ₹850): flagged on the
  author's book card and given to the AI so it explains the rollover.
- **General / account-level tickets** with no book.
- **Empty states** for no books, no tickets, and no tickets matching filters.
- **Closed tickets** can't be replied to; replying to a resolved ticket reopens it.

## Run locally

Backend (needs [uv](https://docs.astral.sh/uv/)):

```bash
cd backend
cp .env.example .env          # add GEMINI_API_KEY (optional: without it the rule fallback is used)
uv sync
uv run python manage.py migrate
uv run python manage.py seed_data      # add --reset to start fresh
uv run python manage.py runserver      # http://localhost:8000, docs at /api/docs/
```

Frontend:

```bash
cd frontend
cp .env.example .env.local    # NEXT_PUBLIC_API_URL=http://localhost:8000/api
npm install
npm run dev                   # http://localhost:3000
```

## Tests

```bash
cd backend && uv run python manage.py test apps
```

16 tests covering role-based access, isolation between authors, validation errors, AI triage and the
rule fallback, admin overrides surviving re-triage, queue ordering, internal-note privacy, polling, draft
caching, prompt scoping, and the royalty payout schedule. The AI provider is mocked, so no key is needed.

## Deployment

- **Backend → Render** using `render.yaml` (build: `backend/build.sh` runs migrations and seeds the
  dataset; start: gunicorn). Set `DATABASE_URL` (Neon), `GEMINI_API_KEY` and `CORS_ALLOWED_ORIGINS`.
- **Frontend → Vercel** with root directory `frontend` and `NEXT_PUBLIC_API_URL=<render-url>/api`.
- Render's free tier sleeps when idle; the first request after a pause can take ~30–50s.

## Known limitations / what I'd do next

- **Background triage uses a thread.** Fine for this scale; in production I'd move triage and draft
  generation to a task queue (Celery + Redis) with retries and backoff on rate limits.
- **Polling** → Server-Sent Events for instant updates and fewer requests at scale.
- **File attachments are UI-only.** Next step: direct-to-S3 uploads with signed URLs, and pass
  image descriptions to the AI for printing-quality tickets.
- **Classification accuracy tracking:** the stored AI-vs-final labels could feed a small dashboard and
  a regression test set for prompt changes.
- **Auth:** JWT in localStorage is simple for a demo; production would use httpOnly cookies with refresh
  rotation, plus rate limiting on login.
- **Email notifications** to authors when a reply is sent, and SLA timers per priority.

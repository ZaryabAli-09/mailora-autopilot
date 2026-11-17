# Mailora API

NestJS runs the HTTP server. The `auth`, `mail`, and `agent` modules own their controllers and application services. The existing Gmail, AI, MongoDB schema, encryption, and worker functions live alongside those modules under `src/`; they retain the behavior covered by the API tests. The MongoDB connection and background timers are started by Nest providers after application initialization. `createApp()` builds an HTTP app without a database or workers for isolated tests.

## Layout

```text
src/
  main.ts                 Production bootstrap
  app.ts                  Nest HTTP setup: CORS, cookies, security, logging, filter
  app.module.ts           Root module and health route
  auth/                   OAuth, session endpoint, encrypted tokens
  mail/                   Inbox and thread routes, Gmail client, sync and snooze workers
  agent/                  Agent routes, AI context, reviewed reply sending
  ai/                     Nebius client and email classification
  database/               Connection provider and Mongoose schemas
  common/                 Session and request guards, error contract
test/                     Node test runner tests, including Nest HTTP contract
```

Controllers implement the public HTTP contract. Feature services implement request handling. Domain functions in `.js` files remain JavaScript to preserve their tested Gmail and MongoDB behavior; `tsconfig.json` compiles them into the same `dist/src` tree. New HTTP code is TypeScript. Mongoose model names, indexes, and persisted document shapes did not change, so no database migration is needed.

## Run

Requires Node.js 20.19 or newer and MongoDB. Copy `.env.example` to `.env` and fill in secrets. From this directory:

```sh
npm ci
npm run dev
```

For a production build:

```sh
npm ci
npm run build
npm start
```

`npm start` runs `dist/src/main.js`. Startup connects to MongoDB before listening and starts the sync and snooze timers. Startup fails if MongoDB is unavailable. `GET /health` reports HTTP process health; it is not a separate MongoDB readiness check.

The small root `index.js` keeps existing `nodemon index` sessions working by loading the Nest development entry point. Prefer `npm run dev` for file watching. Production runs the compiled entry point through `npm start`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port, default `8000`. |
| `NODE_ENV` | `production` enables secure cookies. |
| `CLIENT_URL` | Allowed CORS origin and OAuth redirect destination; default `http://localhost:3000`. |
| `COOKIE_DOMAIN` | Optional shared parent domain for client and API subdomains. Leave empty on localhost. |
| `MONGO_URI` | MongoDB connection string. Required at startup. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Google Web OAuth credentials and exact callback URI. Required for sign in. |
| `JWT_SECRET` | Session signing secret. |
| `TOKEN_ENCRYPTION_KEY` | 64 hexadecimal characters for AES-256-GCM token encryption. |
| `NEBIUS_API_KEY`, `NEBIUS_BASE_URL` | Nebius Token Factory access. |
| `NEBIUS_MODEL_CLASSIFY`, `NEBIUS_MODEL_CHAT` | Exact model IDs for classification and agent answers. |
| `NEBIUS_MODEL_CLASSIFY_FALLBACK` | Optional classification fallback model. |

Run `npm run models` to list Nemotron model IDs available to the configured key. Do not commit `.env`.

## HTTP contract

Base URL is `http://localhost:8000` locally. The frontend depends on these paths and response shapes.

| Method | Path | Purpose | Success |
| --- | --- | --- | --- |
| GET | `/health` | Process health | `200 {"status":"ok"}` |
| GET | `/auth/google` | Start Google consent and set OAuth state cookie | `302` to Google |
| GET | `/auth/google/callback` | Validate state, save encrypted tokens, set session cookie | `302` to `/app`, or `303` to `/login?error=...` |
| GET | `/auth/me` | Current profile and Gmail connection status | `200 {"user":...,"gmailConnected":boolean}` |
| POST | `/auth/logout` | Clear session cookie | `204` |
| GET | `/api/inbox` | Local inbox page | `200 {"threads":[],"nextCursor":null,"sync":...}` |
| POST | `/api/sync` | Queue a forced Gmail sync | `202 {"queued":true}` |
| GET | `/api/threads/:id` | Fetch live Gmail thread | `200 {"thread":...}` |
| POST | `/api/threads/:id/done` | Remove Gmail `INBOX` label | `200 {"done":true}` |
| PUT | `/api/threads/:id/pin` | Set local pin, body `{"pinned":boolean}` | `200 {"pinned":boolean}` |
| POST | `/api/threads/:id/snooze` | Remove inbox label until body `{"until":ISO-8601}` | `200 {"snoozedUntil":ISO-8601}` |
| POST | `/api/agent/ask` | Answer with live inbox context and proposed actions | `200 {"answer":string,"actions":[],"contextCount":number}` |
| POST | `/api/agent/reply` | Send reviewed draft | `200 {"sent":true,"messageId":string}` |

All `/api/*` routes require the seven-day `mailora_session` HTTP-only cookie. `GET /auth/me` returns `401` without it. All non-GET `/api/*` routes and `/auth/logout` require `X-Mailora-Request: 1`, including agent routes. Send cookies with `credentials: "include"` from the browser. CORS allows the configured `CLIENT_URL`, credentials, `GET`/`POST`/`PUT`, and `Content-Type`/`X-Mailora-Request` headers.

`GET /api/inbox` accepts `search` (at most 200 characters), `view` (`all`, `urgent`, `todo`, `meeting`, or `newsletter`), and `cursor` (zero-based offset, at most four digits). It returns at most 25 threads per page from the recent 30-day local snapshot. `POST /api/agent/ask` accepts `prompt` (1–2,000 characters), optional `threadId`, and up to six usable history entries. The agent reads up to 12 current inbox threads, plus a selected thread. Model actions are proposals; the API never applies them as part of `/ask`.

`POST /api/agent/reply` requires `threadId`, `text`, `recipient`, a UUID `idempotencyKey`, and `confirm: true`. The server fetches the live thread and verifies its reply recipient. Reusing a successful key returns the recorded message ID; a changed draft or uncertain send returns `409`. Check Gmail Sent before retrying an uncertain send.

Errors use `{"message":string,"code"?:string}`. Common statuses are `400` invalid input, `401` missing session, `403` missing request header, `404` unknown route/thread, `409` reconnect or conflict, and `502`/`503` provider failure. `GMAIL_RECONNECT`, `GMAIL_API_DISABLED`, and `AI_NOT_CONFIGURED` are machine-readable codes where applicable. Unknown server failures return a generic message.

## Background work and data

Sync imports at most 500 messages from the last 30 days, with five concurrent Gmail fetches and two concurrent AI classifications. It stores bounded plain text, metadata, labels, and classification results. Attachments are skipped. A per-user/message unique index prevents duplicate imports. Inbox reads can queue refresh after 15 minutes; a timer also checks connected users every 15 minutes. Without Nebius access, messages remain available and classification is marked failed for retry.

Snoozes are persisted with a per-user/thread unique index. The worker checks due snoozes every 30 seconds, claims up to 20 at a time, restores `INBOX`, and retries a failed wake later. Worker timers stop on Nest application shutdown. Sync and snooze jobs use local process coordination, so deploy a single API worker instance unless you add distributed job ownership.

## Verification

```sh
npm test
npm run typecheck
npm run build
```

The tests cover OAuth cookie and route behavior, Gmail token encryption and requests, message presentation, classification retries, agent context and action validation, MIME reply composition, and sync mapping. Live Google, Nebius, and MongoDB integration requires configured external services and is not exercised by the isolated test suite.

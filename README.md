# Mailora Autopilot

Mailora Autopilot syncs recent Gmail messages into MongoDB, classifies them with Nebius Nemotron, and displays them in a searchable list beside the conversation reader. The Mailora Agent answers questions about recent live inbox threads and can propose actions and draft replies for review. It does not apply model suggestions automatically.

## Structure

```text
apps/
  client/   Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui
  api/      Express (JavaScript), Mongoose, Google OAuth, Gmail REST API
    src/ai/  Nebius OpenAI client and validated email classifier
docker-compose.yml   Local MongoDB
docs/inbox-spec.md  Evidence, limits, and UI/data contract
```

## Run locally

1. Install Node.js 20.19+ and Docker. Start MongoDB with `docker compose up -d mongo` from the repository root. You can also set `MONGO_URI` to your existing MongoDB database.
2. In Google Cloud Console, enable the Gmail API and create a Web OAuth client. Add `http://localhost:8000/auth/google/callback` as an authorized redirect URI. Configure the consent screen for profile/email and the Gmail scopes in `apps/api/services/google-token.service.js`. Add your account as a test user if the app is in testing mode. Gmail API calls use OAuth tokens, not a separate Gmail API key.
3. Copy `apps/api/.env.example` to `apps/api/.env`. Fill in `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MONGO_URI`, and your Nebius Token Factory `NEBIUS_API_KEY`. Generate **separate** values for `JWT_SECRET` and `TOKEN_ENCRYPTION_KEY` with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Leave `COOKIE_DOMAIN` empty for localhost. Set `NEBIUS_BASE_URL` and the exact model IDs in `NEBIUS_MODEL_CLASSIFY`, `NEBIUS_MODEL_CHAT`, and `NEBIUS_MODEL_PLANNER`; `NEBIUS_MODEL_CLASSIFY_FALLBACK` is optional. Run `npm run models` in `apps/api` to list the Nemotron IDs available to your key. Restart the API after changing `.env`.
4. Copy `apps/client/.env.example` to `apps/client/.env.local`. Keep both client URLs on `localhost` for local cookies.
5. In separate terminals, run `npm install && npm run dev` from `apps/api` and `apps/client`.
6. Open `http://localhost:3000`, choose **Get started**, then **Sign in with Google**. Google consent signs in and connects Gmail in one flow.

The API stores the OAuth token set encrypted with AES-256-GCM in MongoDB and sends a seven-day JWT in an HTTP-only cookie. It refreshes Gmail access tokens using the encrypted refresh token. `/app` requires a valid session and Gmail connection; `/connect` is the only app route available when Gmail must be reconnected. Do not commit `.env` files or share their values.

After sign-in, a background job imports up to 500 Gmail messages from the last 30 days. MongoDB stores each message's sender, subject, snippet, bounded plain-text body, labels, and unsubscribe-header flag; attachment bytes are skipped. A unique user/message index prevents duplicates on re-sync. The inbox reads these stored messages and shows Nemotron summaries and Urgent, Todos, Meetings, and Newsletters views as classification completes. Gmail category labels form Promotions and Updates bundles. Done removes the Gmail `INBOX` label, Pin persists per user in MongoDB, and Snooze removes `INBOX` until a MongoDB-backed worker restores it. The reader fetches the full thread from Gmail on demand.

The classifier sends bounded email text to Nebius and validates the returned category and summary. The agent reads up to 12 recent inbox threads from Gmail for each question and sends a bounded context to Nebius. It shows proposed Done, Pin, Snooze, and Reply actions for review. Clicking **Apply action** uses the existing Gmail or MongoDB endpoint. A reply shows its live thread-derived recipient and editable draft; clicking **Send reviewed reply** sends it through Gmail. MongoDB stores send idempotency metadata without storing reply drafts. If send status is uncertain, check Gmail Sent before trying again. No autonomous sending or inbox mutations run. Without a Nebius key, sync still stores Gmail messages but classifications show a retry state.

## Checks

Run `npm test` in `apps/api` and `npm run build` plus `npm run lint` in `apps/client`.

For production, use HTTPS, a persistent MongoDB instance, secure environment secrets, and a shared `COOKIE_DOMAIN` only when the client and API run on subdomains of the same site. Google may require consent-screen verification before a public release with Gmail scopes.

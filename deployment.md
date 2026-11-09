# Deployment — Kaapi Estate direct booking & enquiry inbox

Repository: https://github.com/Cool-Titan/hotelManagement

## Demo logins

All demo accounts share one password: **`Demo@2026`**. It is set by `SEED_DEMO_PASSWORD` when the database is seeded, and works only on demo data.

| Role | Email | What to try |
|---|---|---|
| Guest | `guest@demo.test` | Book a room, see **My trips** |
| Reservations staff | `reservations@demo.test` | Enquiry inbox, rates & allotment, export |
| General Manager | `gm@demo.test` | Unsorted lane, complaint alerts, cancel bookings |
| Events staff | `events@demo.test` | Owner of wedding enquiries |
| Sales staff | `sales@demo.test` | Owner of offsite enquiries |

You can also create a new guest account from the sign-in page.

**Test payments** (no real money moves):

| Method | Value | Result |
|---|---|---|
| Card | `4242 4242 4242 4242` | Succeeds |
| Card | `4000 0000 0000 0002` | Declined |
| Card | `4000 0000 0000 9995` | Insufficient funds |
| UPI | any ID, e.g. `demo@okbank` | Succeeds |
| UPI | an ID starting with `fail` | Declined |

For cards, any future expiry and any 3-digit CVC work.

**Promo codes:**
- `DIRECT10`: 10% off stays of 2 nights or more.
- `FIRSTSIP`: already fully redeemed, to show the rejection.

## Run it locally

You need **Node.js 20.9+** (developed on 22) and npm. Docker is **not** needed: a script runs a real PostgreSQL 18 from the `embedded-postgres` npm package.

1. **Clone and install.**
   ```bash
   git clone https://github.com/Cool-Titan/hotelManagement.git
   cd hotelManagement
   npm install
   ```
2. **Start a local Postgres.** Keep this terminal open. It listens on `127.0.0.1:54329` and creates the databases `kaapi` and `kaapi_test`. Data is kept in `.local-pg/`, which git ignores.
   ```bash
   npm run db:local
   ```
3. **Create your env files** (in a second terminal).
   ```bash
   cp .env.example .env
   ```
   - In `.env`, set `SESSION_SECRET` to a random value of 32+ characters:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
     ```
   - In `.env`, set `INBOUND_WEBHOOK_SECRET` to any random string, and `SEED_DEMO_PASSWORD=Demo@2026`.
   - Optional: set `GEMINI_API_KEY` (from Google AI Studio) to turn on the AI router. Without a key, the app uses its rule-based fallback, so everything still works but every enquiry lands in **Unsorted** for a person to check. An xAI Grok key (`XAI_API_KEY`) also works.
   The defaults in `.env.example` already point at the local database. Tests use the `kaapi_test` database automatically; set `TEST_DATABASE_URL` to use a different one.
4. **Create the tables and load the sample data.**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
   The seed is idempotent: it wipes the data and recreates it relative to today's date. Run it again any time to reset the demo.
5. **Run the app.**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.
6. **Run the checks.**
   ```bash
   npm run db:test-migrate   # once: create tables in the test database
   npm test                  # Vitest: unit + Postgres integration tests (88)
   npm run typecheck
   npm run lint
   ```

You can use any other Postgres 14+ instead: point `DATABASE_URL` and `DIRECT_URL` at it and skip step 2.

### Simulating inbound email / WhatsApp

Signed-in staff can use **Simulate incoming message** on the inbox. The same path is exposed as webhooks:

```bash
curl -X POST http://localhost:3000/api/inbound/whatsapp \
  -H "content-type: application/json" \
  -H "x-webhook-secret: $INBOUND_WEBHOOK_SECRET" \
  -d '{"fromName":"Nikhil","fromContact":"+91 98450 11223","message":"Is a villa free 14-16 Nov for 2 adults and a child?"}'
```

`/api/inbound/email` takes the same body plus an optional `subject`.

## How it is deployed

- **App:** Vercel (Node.js runtime). When it builds, Vercel runs the `vercel-build` script: `prisma generate && prisma migrate deploy && next build`, so migrations are applied on every deploy.
- **Database:** Neon serverless Postgres. Use the **pooled** connection string for `DATABASE_URL` and the **direct** one for `DIRECT_URL`, which migrations need.
- **AI:** Google Gemini API (`gemini-3.5-flash-lite`, falling back to `gemini-3.1-flash-lite` if it is overloaded) over HTTPS, called only from the server. If the AI fails, the keyword rules take over. To re-run the AI on enquiries the rules had to sort, use `npm run ai:retry`.
- **Background work:** classification runs with Next.js `after()`, after the response is sent, so a guest's form submits instantly even if the AI is slow or down. Abandoned payment holds are released lazily, before every search and checkout, so no cron job is needed.

Steps:
1. Create a Neon project and copy both connection strings.
2. Import the GitHub repo into Vercel. It detects Next.js automatically.
3. Add the environment variables below for Production (and Preview if you use it).
4. Deploy, then seed the demo data once from your machine:
   ```bash
   DATABASE_URL="<neon direct url>" DIRECT_URL="<neon direct url>" SEED_DEMO_PASSWORD="Demo@2026" npm run db:seed
   ```

## Environment variables

Names only. Never commit the values.

| Name | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string (pooled on Neon) |
| `DIRECT_URL` | yes | Direct Postgres connection string for migrations |
| `SESSION_SECRET` | yes | 32+ random characters used to sign session cookies |
| `INBOUND_WEBHOOK_SECRET` | yes | Shared secret required on `/api/inbound/*` |
| `GEMINI_API_KEY` | no* | Google Gemini API key. *Without any AI key, the rule-based fallback is used |
| `GEMINI_MODEL` | no | Comma-separated models to try in order (default `gemini-3.5-flash-lite,gemini-3.1-flash-lite`) |
| `AI_TIMEOUT_MS` | no | Per-request AI timeout (default 20000) |
| `XAI_API_KEY` | no | Alternative provider: xAI Grok key (used only if no Gemini key) |
| `XAI_MODEL` | no | Grok model id (default `grok-4-fast-non-reasoning`) |
| `XAI_BASE_URL` | no | Override the API base URL (default `https://api.x.ai/v1`) |
| `SEED_DEMO_PASSWORD` | seed only | Password given to the seeded demo accounts |

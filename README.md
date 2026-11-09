# Kaapi Estate — direct booking & enquiry inbox

A direct-booking website and staff desk for a 76-key coffee-estate resort in Chikkamagaluru:

- **Guests** pick dates, see real prices including GST, and pay (test mode) in three steps.
- **Reservations staff** control daily rates, the website allotment, blackout dates and promo codes, and export each day's bookings for the reservation system.
- **One inbox** collects web-form, event-form, forwarded-email and WhatsApp enquiries (the last two simulated). An AI router classifies each one, extracts dates, guests and budget, assigns an owner and drafts a reply. Staff review every draft, and the GM sees anything the AI is unsure about.

**Run it:** see [`deployment.md`](deployment.md). Demo logins are in there too.

## Stack

- Next.js 16 (App Router, server actions) + React 19 + TypeScript
- Tailwind CSS 4
- PostgreSQL + Prisma 6
- jose (JWT sessions)
- zod
- Google Gemini (JSON-schema structured output); xAI Grok also supported
- Vitest

## Where things are

| Path | What |
|---|---|
| `src/lib/inventory.ts` | Allotment control: atomic holds, confirm, release, expiry (the "never overbook" logic) |
| `prisma/migrations/*/migration.sql` | Schema, plus the `CHECK (sold + held <= allotment)` backstop |
| `src/lib/pricing.ts` | Rate plans, promos, GST slabs. Prices bookings *and* AI drafts |
| `src/lib/ai/` | Triage: Gemini/Grok clients, keyword fallback, extraction, price stripping, quote insertion |
| `src/lib/enquiries.ts` | Intake and routing for every channel |
| `src/app/(site)/` | Guest site |
| `src/app/admin/` | Staff desk |
| `src/app/actions/` | Server actions. Each one validates its input with zod and re-checks the user's role |
| `src/proxy.ts`, `src/lib/auth.ts` | Access control |
| `tests/` | Unit and Postgres integration tests |
| `prisma/seed.ts` | Sample data, including enquiries ENQ-4410/4411/4412 from the brief |

## Scripts

`dev`, `build`, `test`, `typecheck`, `lint`, `db:local`, `db:migrate`, `db:seed`, `db:test-migrate`, `ai:retry`.

Photos are free-licence (Unsplash/Pexels) stand-ins, credited at `/credits`.

# Handoff

Read `ARCHITECTURE.md` first (what this is), then this file (how to run
it and where things are), then `STATUS.md` (what's actually done).

## What This Product Does

LandingPageBuild.com lets one operator manage a landing page per market
(UK, Germany, etc.) from a single admin panel — editing copy, toggling
an AI pitch widget, and reviewing captured leads per market. Visitors
land on `{market}.landingpagebuild.com`, see copy rendered server-side
from that market's saved config, and (once Phase 2's gaps are closed)
can submit a lead or talk to the AI widget.

## Repo Structure

```
├── worker/           Cloudflare Worker API (Hono). Two products live here:
│                      the market-admin system (/api/admin/*, KV-backed
│                      config:{market}) that this product actually is, and
│                      a retired multi-tenant builder (/auth, /websites*,
│                      /ai, /versions) — see ARCHITECTURE.md "What Is Retired".
├── astro/            Public-facing Astro site. src/pages/index.astro is
│                      the real market landing page. src/pages/site/ is
│                      the retired surface — do not build on it.
├── admin/             Admin panel — separate Vite + React SPA, its own
│                      Cloudflare Pages project. Talks to worker/ over HTTPS.
├── schema/            D1 schema (schema.sql) — run via wrangler d1 execute.
├── worker/migrations/ D1 migrations applied after the initial schema.
├── scripts/            Shell scripts to seed staging KV/D1 test data.
├── worker/scripts/    bootstrap-admin.mjs — creates a super_admin account
│                      directly against D1+KV when no admin session exists yet.
├── wrangler.toml      Root — the Worker API's config (production + staging).
├── ARCHITECTURE.md    What this product is/isn't, stack, retired surfaces.
├── STATUS.md          Actual phase-by-phase build status.
└── HANDOFF.md         This file.
```

## Run It Locally

From the repo root, for each of the three apps (separate `node_modules`,
run each `npm install` once):

```bash
npm install
cd astro && npm install && cd ..
cd admin && npm install && cd ..
```

Worker API (root) — runs against the **staging** D1/KV by default:

```bash
npm run dev          # wrangler dev --env staging, http://localhost:8787
```

Astro site:

```bash
cd astro
npm run dev           # astro dev, http://localhost:3000 (pinned — see astro/README.md)
```

Admin panel:

```bash
cd admin
npm run dev           # vite, default Vite dev port
```

The Astro dev server reads the **real staging KV namespace** directly
(`remote = true` in `astro/wrangler.toml` + `remoteBindings: true` in
`astro.config.mjs`) — there's no local KV seeding step, but local dev
talks to live staging data. Be aware of that before writing test data
locally.

## Deploy to Staging

Worker API:

```bash
npm run deploy:staging   # wrangler deploy --env staging
```

Astro site:

```bash
cd astro
npm run deploy            # astro build && wrangler deploy dist/server/entry.mjs --assets=dist/client
```

Admin panel:

```bash
cd admin
npm run deploy            # vite build && wrangler pages deploy dist --project-name=landingpagebuild-admin-staging
```

None of these have CI/auto-deploy — every deploy above is a manual
command someone runs locally. Don't write or imply "push to deploy"
anywhere; it isn't true yet.

## Deploy to Production

Worker API — this one works today:

```bash
npm run deploy            # wrangler deploy (top-level env = production)
```

Astro site and admin panel — **these do not have a production deploy
path yet.** `astro/wrangler.toml` has no `[env.production]` block or
production KV binding, and `admin/package.json`'s `deploy` script is
hardcoded to the staging Pages project name. See `STATUS.md`'s Phase 4
entry — adding these is upcoming work, not a command you're missing.

## D1 Migrations

```bash
npm run db:migrate:staging   # applies schema/schema.sql to lpb-staging-db
npm run db:migrate:prod      # applies schema/schema.sql to lpb-prod-db
```

`worker/migrations/` holds migrations applied after the initial schema
(e.g. `0002_leads_market_schema.sql`) — run those by hand with
`wrangler d1 execute <db-name> --file=worker/migrations/<file>.sql`
against the environment you're targeting; they aren't wired into the
`db:migrate:*` scripts above.

## Secrets

Set once per environment with `wrangler secret put <NAME>` (append
`--env staging` for staging) from the repo root, against `wrangler.toml`:

| Secret | Purpose |
|---|---|
| `JWT_SECRET` | Signs/verifies every auth token — both `/auth/login` (7-day) and `/api/admin/login` (30-minute) tokens |
| `ANTHROPIC_API_KEY` | Calls the Claude API for `/websites/:id/ai/chat` and `/ai/generate` (the retired multi-tenant surface's AI features) |
| `RESEND_API_KEY` | Sends lead-notification and welcome emails via Resend |
| `NOTIFICATION_TO_EMAIL` | Recipient address for lead-notification emails |
| `STRIPE_SECRET_KEY` | **Placeholder only.** No billing logic exists yet — do not wire this without explicit sign-off |
| `STRIPE_WEBHOOK_SECRET` | **Placeholder only.** Same as above |

Non-secret public build-time config (`PUBLIC_WORKER_API_URL`) lives in
`astro/.env` and `admin/.env` — inlined into the client bundle by Vite,
gitignored, safe to be non-secret since it's just the Worker's URL.

## What To Work On Next

See `STATUS.md` for the real per-phase state. The highest-priority gap
is Phase 2: the live market page has no lead capture and no working AI
widget — that's the next planned work (Priority 1 in the agreed plan),
followed by wiring a real production DNS/deploy path (Priority 2).

## What Not To Touch

The retired multi-tenant builder surface — see `ARCHITECTURE.md`'s
"What Is Retired" section in full. In short:

- `astro/src/pages/site/[subdomain]/[...slug].astro` and everything it
  alone depends on (`SectionRenderer.astro`, `astro/src/components/sections/*`,
  and `ChatWidget.tsx`/`LeadForm.tsx` **as used by that route**)
- The Worker routes backing it: `worker/src/routes/auth.ts`,
  `websites.ts`, `pages.ts`, `versions.ts`, `ai.ts`, and the `/auth`,
  `/websites*` mounts in `worker/src/index.ts`

These render nothing in production today (nothing publishes to the KV
shape the Astro route reads) and are scheduled for deletion in a future
cleanup pass. Don't extend them, and don't build new market-facing
features (like Priority 1's lead capture / AI widget) on top of them —
build against the `config:{market}` / `/api/admin/*` system instead,
which is what's actually live.

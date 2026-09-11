# Handoff

Read `ARCHITECTURE.md` first (what this is), then this file (how to run
it, where things are, and what's actually live), then `STATUS.md`
(phase-by-phase detail).

## What This Product Does

LandingPageBuild.com lets one operator manage a landing page per market
(UK, Germany, France) from a single admin panel — editing copy,
toggling an AI pitch widget, and reviewing captured leads per market.
Visitors land on `{market}.landingpagebuild.com`, see copy rendered
server-side from that market's saved config, and can submit a lead or
talk to the AI pitch widget.

## Repo Structure

```
├── worker/           Cloudflare Worker API (Hono). Two products live here:
│                      the market-admin system (/api/admin/*, /api/leads/*,
│                      /api/ai/*, /api/export/* — KV-backed config:{market})
│                      that this product actually is, and a retired
│                      multi-tenant builder (/auth, /websites*, /ai,
│                      /versions) — see ARCHITECTURE.md "What Is Retired".
├── astro/            Public-facing Astro site, deployed as a genuine
│                      Cloudflare Worker (not Pages — see its wrangler.toml
│                      header). src/pages/index.astro is the real market
│                      landing page. src/pages/site/ is the retired
│                      surface — do not build on it.
├── admin/             Admin panel — separate Vite + React SPA, its own
│                      Cloudflare Pages projects (staging + production).
│                      Talks to worker/ over HTTPS.
├── schema/            D1 base schema (schema.sql) — run via wrangler d1 execute.
├── worker/migrations/ D1 migrations applied after the initial schema.
├── scripts/            Seed scripts for staging/production KV+D1 test data.
├── worker/scripts/    bootstrap-admin.mjs — creates a super_admin account
│                      directly against D1+KV when no admin session exists yet.
├── wrangler.toml      Root — the Worker API's config. Top-level = production,
│                      [env.staging] = staging (inverted vs. astro/'s file — see below).
├── DEPLOY.md          One-time setup + exact deploy commands, both environments.
├── ARCHITECTURE.md    What this product is/isn't, stack, retired surfaces.
├── STATUS.md          Actual phase-by-phase build status.
└── HANDOFF.md         This file.
```

## Current Deploy State (both environments live as of this pass)

| Service | Staging | Production |
|---|---|---|
| Worker API | `landingpagebuild-worker-staging` → `api.staging.landingpagebuild.com` | `landingpagebuild-worker` → `api.landingpagebuild.com` |
| Astro renderer | `landingpagebuild-astro-staging` → `uk/de/fr.staging.landingpagebuild.com` | `landingpagebuild-astro` → `uk/de/fr.landingpagebuild.com` + apex `landingpagebuild.com` |
| Admin panel | Pages project `landingpagebuild-admin-staging` → `landingpagebuild-admin-staging.pages.dev` | Pages project `landingpagebuild-admin-production` → `landingpagebuild-admin-production.pages.dev` (no custom domain yet — see "Manual Steps Remaining") |

Both the Worker and the Astro renderer are deployed as genuine Cloudflare
Workers with Custom Domains — **not** Cloudflare Pages, for either
service. Only the admin panel uses Pages (it's a 100%-client-side SPA
with no SSR needs). Don't "fix" the Worker deploys to use
`wrangler pages deploy` — that was tried once for the Astro app and
reintroduces a documented, already-fixed bug (see `astro/wrangler.toml`'s
header comment).

**Naming gotcha**: the root `wrangler.toml` (Worker API) has its
top-level config as production and `[env.staging]` as the named
environment — plain `wrangler deploy` targets production there.
`astro/wrangler.toml` is the opposite: top-level is staging and
`[env.production]` is the named environment — plain `wrangler deploy`
there targets *staging*. Always use the npm scripts below rather than
raw `wrangler deploy`, so you don't have to hold this in your head.

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
talks to live staging data.

**Admin panel env-file caveat**: `admin/.env` is the *only* env file
this project has — there's no separate `.env.production`. Its
`PUBLIC_WORKER_API_URL` gets baked into whatever you build next. The
default committed convention is staging (`api.staging.landingpagebuild.com`),
matching local dev. **Before running `deploy:production` for admin,
you must temporarily point this at `api.landingpagebuild.com`, build,
deploy, then set it back** — this file does not currently branch by
environment automatically. (This bit someone during this pass: a first
`deploy:production` build silently baked in the staging API URL and had
to be rebuilt before deploying. Worth fixing properly — e.g. Vite's
`--mode` + `.env.production`/`.env.staging` files — as follow-up work,
not done in this pass.)

## Deploy — Exact Order and Commands

**Worker first (API must be live before the frontends), Astro second,
Admin third.** See `DEPLOY.md` for the full one-time setup (secrets, D1
migrations, Pages project creation) — this is the command sequence only.

### Staging

```bash
npm run deploy:staging                                    # Worker
cd astro && npm run deploy:staging && cd ..                # Astro
cd admin && npm run deploy:staging && cd ..                 # Admin
```

### Production

```bash
npm run deploy:production                                  # Worker — wrangler deploy, no --env (see gotcha above)
cd astro && npm run deploy:production && cd ..              # Astro — wrangler deploy --env production
cd admin && npm run deploy:production && cd ..               # Admin — wrangler pages deploy, remember the .env caveat above
```

None of these auto-deploy on push for the Worker or Astro — every
deploy above is a manual command someone runs locally. **The admin
panel's staging Pages project does now have Git integration connected**
(confirmed via `wrangler pages project list` → `Git Provider: Yes`) —
pushing any branch auto-builds a preview deployment there, and pushes
to `main` auto-deploy to its Production environment. This wasn't true
when earlier docs were written; it's real now. The production admin
Pages project's Git integration status hasn't been checked.

## D1 Migrations

```bash
npm run db:migrate:staging   # applies schema/schema.sql to lpb-staging-db
npm run db:migrate:prod      # applies schema/schema.sql to lpb-prod-db
```

`worker/migrations/` holds migrations layered on top of the initial
schema — **not** wired into the `db:migrate:*` scripts above, must be
applied by hand, and **must include `--remote`** or they silently apply
to a local emulated database instead of the real one:

```bash
npx wrangler d1 execute lpb-staging-db --remote --file=worker/migrations/0002_leads_market_schema.sql
npx wrangler d1 execute lpb-staging-db --remote --file=worker/migrations/0003_leads_add_company.sql
npx wrangler d1 execute lpb-prod-db --remote --file=worker/migrations/0002_leads_market_schema.sql
npx wrangler d1 execute lpb-prod-db --remote --file=worker/migrations/0003_leads_add_company.sql
```

Both migrations are now applied to **both** `lpb-staging-db` and
`lpb-prod-db` as of this pass — `leads` has `market`/`subdomain`/`company`
on both. Confirmed via `PRAGMA table_info(leads)` against each.

## Secrets

Set once per environment with `wrangler secret put <NAME>` (append
`--env staging` for staging, no flag for production) from the repo
root:

| Secret | Purpose |
|---|---|
| `JWT_SECRET` | Signs/verifies every auth token — both `/auth/login` (7-day) and `/api/admin/login` (30-minute) tokens |
| `ANTHROPIC_API_KEY` | Calls the Claude API for the live `/api/ai/:market` pitch widget (and the retired `/websites/:id/ai/*` routes) |
| `RESEND_API_KEY` | Sends lead-notification and welcome emails via Resend |
| `NOTIFICATION_TO_EMAIL` | Recipient address for lead-notification emails |
| `STRIPE_SECRET_KEY` | **Placeholder only.** No billing logic exists yet — do not wire this without explicit sign-off |
| `STRIPE_WEBHOOK_SECRET` | **Placeholder only.** Same as above |

**All four real secrets are now set on both staging and production**
(confirmed via `wrangler secret list`, verified functionally: the AI
pitch endpoint returns real generated pitches and lead capture writes
successfully on both environments). Stripe secrets are set on neither —
correct, per the placeholder-only rule.

Non-secret public build-time config (`PUBLIC_WORKER_API_URL`) lives in
`astro/.env` and `admin/.env` — inlined into the client bundle by Vite,
gitignored. See the admin env-file caveat above.

## Markets Seeded

| Market | Staging KV | Production KV |
|---|---|---|
| `markets:index` | `["uk","de","fr"]` | `["uk","de","fr"]` |
| `config:uk` | Set (real copy) | Set (real copy) |
| `config:de` | Set (real copy) | Set (real copy) |
| `config:fr` | **Not set** — `fr` is listed in `markets:index` but has no config yet; the market page shows its placeholder-content fallback | Set (real copy) |

Production actually has more complete market data than staging right
now (`config:fr` exists on production, not on staging) — seeded
directly during this deploy pass, not backfilled to staging. Worth
doing if staging should mirror production going forward.

## Manual Steps Remaining

These need the Cloudflare Dashboard — neither is expressible via
`wrangler` CLI.

**Manual Step 1 — Admin panel production custom domain**
In the Cloudflare Dashboard: Pages → `landingpagebuild-admin-production`
→ Custom Domains → add `app.landingpagebuild.com`. Until this is done,
production admin is only reachable at
`landingpagebuild-admin-production.pages.dev`.

**Manual Step 2 — Admin panel staging DNS record**
In the Cloudflare Dashboard: DNS for `landingpagebuild.com` → add a
CNAME record:
- Name: `app.staging`
- Target: `landingpagebuild-admin-staging.pages.dev`
- Proxy status: Proxied (orange cloud)

Neither has been done as part of this pass.

## Known Gap: the Apex Domain

`landingpagebuild.com` (bare, no subdomain) now has a live Custom
Domain route pointing at the production Astro Worker — but
`astro/src/lib/marketConfig.ts`'s `marketFromHost()` has no concept of
a distinct platform homepage. A visitor hitting the bare apex today
gets the **UK market's** `config:uk` content, not dedicated marketing
copy. The route works; the content it serves is not what "platform
homepage" implies. Not addressed in this pass — flagged, not fixed.

## What Not To Touch

The retired multi-tenant builder surface — see `ARCHITECTURE.md`'s
"What Is Retired" section in full. In short:

- `astro/src/pages/site/[subdomain]/[...slug].astro` and everything it
  alone depends on (`SectionRenderer.astro`, `astro/src/components/sections/*`,
  and `ChatWidget.tsx`/`LeadForm.tsx` **as used by that route** — not
  the live `components/market/` versions of the latter two)
- The Worker routes backing it: `worker/src/routes/auth.ts`,
  `websites.ts`, `pages.ts`, `versions.ts`, `ai.ts`, and the `/auth`,
  `/websites*` mounts in `worker/src/index.ts`

These render nothing in production (nothing publishes to the KV shape
the Astro route reads) and are scheduled for deletion in a future
cleanup pass. Don't extend them, and don't build new market-facing
features on top of them — build against the `config:{market}` /
`/api/admin/*` / `/api/leads/*` / `/api/ai/*` system instead, which is
what's actually live in both environments now.

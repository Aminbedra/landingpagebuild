# Deploy

Deploy order matters: **Worker first, Astro second, Admin panel third.**
The Astro renderer and the admin panel both call the Worker API at
request/runtime — deploying either of them before the Worker is live
just means their first real requests fail until the Worker catches up.

This file documents the commands only. It does not deploy anything on
its own, and nothing here has been run against production.

## One-time setup (before the first production deploy of each service)

These only need doing once, ever, per environment — not on every deploy.

**Worker API** — nothing extra. `wrangler.toml` already declares the
production D1 database, KV namespaces, and R2 bucket; `wrangler deploy`
creates the Worker script itself on first run.

**Astro renderer** — nothing extra, same reasoning: `wrangler deploy`
creates the Worker script on first run. `astro/wrangler.toml`'s
`[env.production]` block already declares its KV binding and routes.

**Admin panel** — the Cloudflare Pages project must exist before
`deploy:production` can push to it (unlike a Worker, `wrangler pages
deploy` does not create a new Pages project implicitly the way `wrangler
deploy` does for Workers):

```bash
npx wrangler pages project create landingpagebuild-admin-production
```

Wrangler will prompt for a production branch name — `main` is fine,
this repo has no CI/auto-deploy tied to branches either way (see
`HANDOFF.md`). This command has **not** been run as part of this
change — it creates a real resource on the Cloudflare account.

**Custom Domains** (Worker + Astro): `wrangler deploy --env production`
auto-provisions DNS + SSL for the routes declared in each `wrangler.toml`
the first time it runs, the same way the staging domains were
provisioned — no separate DNS step. See `astro/wrangler.toml`'s comments
for the one caveat: the `landingpagebuild.com` apex route serves the UK
market's config today (no distinct homepage exists yet — see
`STATUS.md`), so that specific route will work but won't do what
"platform homepage" implies until that gap is closed separately.

**Secrets** — must be set per environment before that environment's
Worker will actually function (JWT signing, AI calls, email all fail
without them). See `HANDOFF.md`'s Secrets table for what each one does:

```bash
# staging (append --env staging to each)
npx wrangler secret put JWT_SECRET --env staging
npx wrangler secret put ANTHROPIC_API_KEY --env staging
npx wrangler secret put RESEND_API_KEY --env staging
npx wrangler secret put NOTIFICATION_TO_EMAIL --env staging

# production (no --env — top-level in the root wrangler.toml is production)
npx wrangler secret put JWT_SECRET
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put NOTIFICATION_TO_EMAIL
```

Confirmed via this session's audit: staging already has all four set.
Production has **none** set — the production Worker doesn't exist on
the account yet at all (see `STATUS.md`).

**D1 schema** — must be applied before the Worker can read/write `users`
or `leads`:

```bash
npm run db:migrate:staging
npm run db:migrate:prod
```

`worker/migrations/` holds migrations layered on top of the initial
schema (e.g. the market/subdomain columns on `leads`) — these are
**not** wired into the `db:migrate:*` scripts above and must be applied
by hand, in order, against whichever database you just migrated:

```bash
npx wrangler d1 execute <db-name> --env <staging|""> --remote --file=worker/migrations/0002_leads_market_schema.sql
npx wrangler d1 execute <db-name> --env <staging|""> --remote --file=worker/migrations/0003_leads_add_company.sql
```

## Deploy to staging

In order:

```bash
# 1. Worker API
npm run deploy:staging

# 2. Astro renderer (market pages)
cd astro && npm run deploy:staging && cd ..

# 3. Admin panel
cd admin && npm run deploy:staging && cd ..
```

## Deploy to production

Same order, production variants:

```bash
# 1. Worker API
npm run deploy:production

# 2. Astro renderer (market pages)
cd astro && npm run deploy:production && cd ..

# 3. Admin panel — requires the one-time Pages project creation above first
cd admin && npm run deploy:production && cd ..
```

## After deploying — verify before calling it done

Same pattern this project has used for every staging deploy so far
(`STATUS.md`'s Phase 2 entry): curl the new domain directly rather than
assuming a successful `wrangler deploy` means the route actually works.

```bash
curl -s -w "\nHTTP %{http_code}\n" https://api.landingpagebuild.com/health
curl -s -o /dev/null -w "%{http_code}\n" https://uk.landingpagebuild.com/
```

A Custom Domain's SSL certificate can take a few minutes to provision on
its first deploy (observed directly during the staging rollout in this
project's history) — a `000`/SSL-handshake failure right after the first
deploy isn't necessarily broken, just not ready yet. Re-check after a
few minutes before troubleshooting further.

## What's NOT covered by this file

- CI/auto-deploy — doesn't exist for any of the three services
  (`HANDOFF.md`). Every command above is manual.
- The `landingpagebuild.com` apex route's "platform homepage" content —
  routing exists (once deployed), the distinct homepage page it should
  serve does not. See `STATUS.md`.
- Actually running any of the commands above against production. This
  pass was config and scripts only, per instruction.

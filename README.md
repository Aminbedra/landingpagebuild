# LandingPageBuild.com — Worker API

AI-first landing page builder. Cloudflare Workers backend.

## Cloudflare Infrastructure (already provisioned)

| Resource | Name | ID |
|---|---|---|
| D1 Prod | lpb-prod-db | 05b8b59e-ae13-442c-bef5-38bb3515a037 |
| D1 Staging | lpb-staging-db | 98dc2329-0e0c-4fcb-9871-46a553f2131d |
| KV Prod | lpb-prod-kv | e4a5bf2e70054fadadc41e4cdb968cd7 |
| KV Staging | lpb-staging-kv | 3f5a4a30c4164a948a56cadd21c25d49 |
| KV Sessions | lpb-sessions-kv | d9c3135ef13a4923ad6f3eea4eef081d |
| R2 | lpb-prod-assets | Enable R2 in dashboard first |

## Local Setup

```bash
npm install
wrangler login
```

## Secrets (run once per environment)

```bash
wrangler secret put JWT_SECRET
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put RESEND_API_KEY        # Phase 5
wrangler secret put STRIPE_SECRET_KEY     # Stripe pending
wrangler secret put STRIPE_WEBHOOK_SECRET # Stripe pending
```

## Development

```bash
npm run dev          # local dev server on http://localhost:8787
```

## Deploy

```bash
npm run deploy:staging   # deploy to staging
npm run deploy           # deploy to production
```

## Enable R2 (one-time manual step)

1. Go to Cloudflare Dashboard
2. Click R2 in the left sidebar
3. Enable R2 (requires billing setup)
4. Uncomment the R2 binding in wrangler.toml

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | /health | None | Health check |
| POST | /auth/register | None | Create account |
| POST | /auth/login | None | Get JWT token |
| GET | /auth/me | JWT | Current user |
| GET | /websites | JWT | List websites |
| POST | /websites | JWT | Create website |
| GET | /websites/:id | JWT | Get website |
| PATCH | /websites/:id | JWT | Update website |
| DELETE | /websites/:id | JWT | Archive website |
| POST | /websites/:id/clone | JWT | Clone website |
| GET | /websites/:id/pages | JWT | List pages |
| POST | /websites/:id/pages | JWT | Create page |
| PATCH | /websites/:id/pages/:pid | JWT | Update page |
| DELETE | /websites/:id/pages/:pid | JWT | Delete page |
| POST | /websites/:id/leads | None | Submit lead (public) |
| GET | /websites/:id/leads | JWT | List leads |
| GET | /websites/:id/leads/export | JWT | CSV export |
| GET | /websites/:id/versions | JWT | List versions |
| POST | /websites/:id/versions | JWT | Save snapshot |
| POST | /websites/:id/versions/:vid/rollback | JWT | Rollback |
| POST | /websites/:id/ai/generate | JWT | Generate full site |
| POST | /websites/:id/ai/chat | JWT | AI chat edit |

## Build Phases

- [x] Phase 1 — Foundation (this file)
- [x] Phase 2 — Astro landing page template ([astro/](astro/README.md))
- [ ] Phase 3 — Admin panel
- [ ] Phase 4 — DNS subdomain routing
- [ ] Phase 5 — Leads intelligence (Resend + HubSpot + CSV)
- [ ] Phase 6 — Media library (R2)
- [ ] Phase 7 — Analytics
- [ ] Phase 8 — Style presets

## Stripe (pending integration)

Stripe primitives to use when Phase billing is built:
- `Product` per plan tier (Basic, Pro, Agency)
- `Price` per product (monthly + annual)
- `Subscription` per website (Basic/Pro) or per account (Agency)
- `Connect` for agency reseller payouts

# Build Status

Last audited: 2026-09-10, against the committed source (no live
deployment checks were possible from the auditing environment — network
access was unavailable, so "deployed" below means "config/route exists
in the repo," not "confirmed reachable").

Status reflects what's actually wired end-to-end, not what a commit
message or the old root README checklist claimed.

---

**Phase 1 — Foundation: COMPLETE**

Hono router, D1 (`DB`), KV (`KV`, `SESSIONS`), R2 (`MEDIA_BUCKET`)
bindings all present in `wrangler.toml` for both `production` and
`staging` environments. JWT auth (HMAC-SHA256, hand-rolled, no external
lib) works for both the general app (`/auth/register`, `/auth/login`)
and the admin panel (`/api/admin/login`, separate shorter-lived token).

Note: `worker/src.backup-20260831-015741/` sits alongside the live
`worker/src/` from a same-day rewrite. It's gitignored (not committed),
so it's not a repo-hygiene problem, but it's worth deleting locally once
you've confirmed the live `worker/src/` is stable — git history is the
real backup.

---

**Phase 2 — Astro Landing Page: PARTIAL**

Done:
- `astro/src/pages/index.astro` — market-aware SSR page. Derives market
  from the `Host` header, reads `config:{market}` from KV, renders
  headline/subheadline/body/CTA/hero image, resolves a style preset,
  records a pageview (Phase 7).
- Placeholder content and a 404-safe fallback when no config exists yet
  for a market.

Missing:
- **No lead capture on this page.** `LeadForm.tsx` exists but requires a
  `websiteId` from the retired multi-tenant model (see
  `ARCHITECTURE.md`) — a market page has no such record, so the form
  can't be rendered here without new, market-scoped wiring.
- **No AI pitch widget on this page.** Same problem — `ChatWidget.tsx`
  requires a `websiteId` and calls an owner-authenticated endpoint
  (`/websites/:id/ai/chat`). The `aiEnabled` toggle currently renders a
  static sentence ("AI Pitch Widget is enabled... no visitor-facing
  widget wired up yet") instead of a working widget.
- This is the single biggest gap against the MVP brief — two of the six
  MVP success criteria (lead capture, AI widget) are not connected to
  the page real visitors actually see.

---

**Phase 3 — Admin Panel: COMPLETE (staging only)**

Copy editor, AI toggle, clone market, version history + rollback, leads
dashboard with CSV export, user management (list/create/change role) —
all built and wired to the Worker API. Session handling (30-minute
tokens with silent idle refresh) works.

Deployed manually to the Cloudflare Pages project
`landingpagebuild-admin-staging` — there is no Git integration and no
CI; `npm run deploy` from `admin/` is the only deploy path today, and it
targets that one staging project name. No production Pages project is
configured.

---

**Phase 4 — DNS Routing: PARTIAL**

Done:
- `astro/wrangler.toml` has custom-domain routes for
  `uk.landingpagbuild.com`, `de.landingpagbuild.com`,
  `fr.landingpagbuild.com` — the **typo domain**, which
  `ARCHITECTURE.md` now designates as a production-redirect-only
  domain, not staging. These routes need to move.

Missing:
- No route anywhere for `staging.landingpagebuild.com` (the actual
  staging domain per `ARCHITECTURE.md`) or any `{market}.` subdomain of
  it.
- No route anywhere for production `landingpagebuild.com` or any
  `{market}.landingpagebuild.com` subdomain.
- No route for `app.landingpagebuild.com` (admin panel) or
  `api.landingpagebuild.com` (Worker API) in either environment — the
  Worker API is reachable only via its `*.workers.dev` URL today
  (`landingpagebuild-worker-staging.aminbedra-045.workers.dev`, per
  `astro/.env`).
- `astro/wrangler.toml` has no production KV binding and no `[env.production]`
  block at all — there is currently no way to deploy the Astro renderer
  to production without adding this first.
- Markets actually seeded: `uk`, `de`, `fr` (see
  `scripts/seed-admin-kv.sh`) — not `sweden` as named in earlier
  planning. `fr` is in `markets:index` but has no `config:fr` yet.

---

**Phase 5 — Leads Intelligence: PARTIAL**

Done:
- Resend email notifications on new leads (gated by each market's
  `emailNotifications` flag) and on new admin-created users.
- CSV export for both the general-app leads endpoint and the
  market-admin leads endpoint.

Missing:
- HubSpot connector placeholder was never built. (Checked deliberately
  before building Part 4 of Phase 3 — no `invite_token`/`user_markets`/
  HubSpot scaffolding exists anywhere in the codebase. Not a bug, just
  unstarted.)

---

**Phase 6 — Media Library: PARTIAL (unverified)**

Done:
- Upload / list / delete / public-serve routes against R2, 5MB limit,
  image-type allowlist.
- Admin `MediaLibrary` UI with a "Set as hero" action that writes
  straight into a market's `config`.

Missing / unverified:
- A comment in root `wrangler.toml` notes R2 was only recently enabled
  on the Cloudflare account and that the bucket
  (`landingpagebuild-media-production` / `-staging`) must exist via
  `wrangler r2 bucket create` before the binding resolves. Whether that
  bucket actually exists was not confirmed in this audit (no network
  access) — treat Media Library as untested until someone uploads a
  file against a real deployment.

---

**Phase 7 — Analytics: COMPLETE**

Pageviews recorded per market per day in KV (bot requests excluded by
user-agent pattern), merged with D1 lead counts into a daily series +
totals, admin `AnalyticsPanel` renders it.

---

**Phase 8 — Style Presets: COMPLETE**

5 style presets (colours, fonts, layout, border radius) and 8
industry copy templates, both served from the Worker and resolved
server-side by the Astro renderer at request time. Admin `PresetsPanel`
UI wired to both.

---

## Summary

| Phase | Status |
|---|---|
| 1 — Foundation | COMPLETE |
| 2 — Astro Landing Page | PARTIAL — lead capture + AI widget not wired to the live page |
| 3 — Admin Panel | COMPLETE (staging only) |
| 4 — DNS Routing | PARTIAL — staging-only, wrong domain, no production, no app./api. routes |
| 5 — Leads Intelligence | PARTIAL — HubSpot placeholder not built |
| 6 — Media Library | PARTIAL — R2 bucket existence unverified |
| 7 — Analytics | COMPLETE |
| 8 — Style Presets | COMPLETE |

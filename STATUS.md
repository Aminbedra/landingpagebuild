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

**Phase 2 — Astro Landing Page: COMPLETE (staging)**

Done:
- `astro/src/pages/index.astro` — market-aware SSR page. Derives market
  from the `Host` header, reads `config:{market}` from KV, renders
  headline/subheadline/body/CTA/hero image, resolves a style preset,
  records a pageview (Phase 7).
- Placeholder content and a 404-safe fallback when no config exists yet
  for a market.
- **Lead capture** — `POST /api/leads/:market` (public, no auth), and a
  market-scoped `LeadForm` island (`astro/src/components/market/`).
  Verified live on staging via curl and direct page fetch.
- **AI pitch widget** — `POST /api/ai/:market` (public, no auth, gated
  by `config:{market}`'s `aiEnabled`), and a market-scoped
  `AIPitchWidget` island. Verified live on staging: renders only where
  `aiEnabled` is true, correctly absent where it's false. The endpoint
  itself is gating/validating correctly, but currently 503s past those
  checks because the Anthropic account behind `ANTHROPIC_API_KEY` is out
  of credit (confirmed via `wrangler tail`, not a code issue) — a real
  pitch response is unverified until that's topped up.

Not done: the two closed gaps above were the only ones tracked for this
phase. Nothing else outstanding.

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
| 2 — Astro Landing Page | COMPLETE (staging) — AI pitch response unverified pending Anthropic account credit |
| 3 — Admin Panel | COMPLETE (staging only) |
| 4 — DNS Routing | PARTIAL — staging-only, wrong domain, no production, no app./api. routes |
| 5 — Leads Intelligence | PARTIAL — HubSpot placeholder not built |
| 6 — Media Library | PARTIAL — R2 bucket existence unverified |
| 7 — Analytics | COMPLETE |
| 8 — Style Presets | COMPLETE |

---

## Retired Surfaces

The multi-tenant website builder surface (Product A — arbitrary
user-created `websites`/`pages`, owner-JWT AI chat/generate, `website_id`-
scoped leads/versions) is retired as of 2026-09, superseded by the
market-routing model (Product B — `config:{market}` in KV, the live
system this product actually is). See `ARCHITECTURE.md` "What Is
Retired" for the product-level explanation.

Every file below carries a `// RETIRED — 2026-09` comment. **Not
deleted yet** — deletion is a separate, later cleanup pass, after the
retirement is confirmed to have broken nothing.

**Fully retired** (entire file):

- `astro/src/pages/site/[subdomain]/[...slug].astro` — the retired
  route itself
- `astro/src/components/SectionRenderer.astro`
- `astro/src/components/sections/CTA.astro`
- `astro/src/components/sections/Contact.astro`
- `astro/src/components/sections/Custom.astro`
- `astro/src/components/sections/FAQ.astro`
- `astro/src/components/sections/Features.astro`
- `astro/src/components/sections/Hero.astro`
- `astro/src/components/sections/Testimonials.astro`
- `astro/src/components/ChatWidget.tsx` — the top-level one; not to be
  confused with the live `components/market/AIPitchWidget.tsx`
- `astro/src/components/LeadForm.tsx` — the top-level one; not to be
  confused with the live `components/market/LeadForm.tsx`
- `astro/src/lib/kv.ts` — also *is* the dead publish-flow itself: the
  `page:{subdomain}:{slug}` KV shape it reads was never written by
  anything, in any phase
- `astro/src/lib/api.ts` — `submitLead`/`sendChatMessage`, called only
  by the two retired components above
- `worker/src/routes/auth.ts`
- `worker/src/routes/websites.ts`
- `worker/src/routes/pages.ts`
- `worker/src/routes/versions.ts`
- `worker/src/routes/ai.ts` — not to be confused with the live
  `worker/src/routes/publicAi.ts`
- `worker/src/routes/leads.ts` — not to be confused with the live
  `worker/src/routes/publicLeads.ts`. Note: this file's lead-capture
  handler sends a Resend notification email that the live
  `publicLeads.ts` doesn't yet have — a real gap, flagged as follow-up,
  not carried over during retirement.

**Partially retired** (only specific exports — the comment is scoped to
just that export, not the whole file, since the rest of the file is
still live):

- `worker/src/middleware/requireAuth.ts` — `requireAuth()` and the
  `AppContext` type are retired; `requireSuperAdmin()` stays live (gates
  every `/api/admin/*` route).
- `worker/src/lib/utils.ts` — `parsePagination()` is retired; `ok`,
  `err`, `generateId`, `now`, `corsHeaders` stay live.
- `worker/src/types.ts` — `WebsiteStatus`, `WebsitePlan`,
  `SubscriptionStatus`, and the `Website`/`Page`/`Lead`/`Version`
  interfaces are retired; `Env`, `User`, `UserRole`, `JwtPayload`,
  `ApiResponse` stay live.
- `worker/src/lib/emailTemplates.ts` — `buildLeadEmailHtml()` is
  retired; `escapeHtml()` and `buildWelcomeEmailHtml()` stay live.
- `worker/src/index.ts` — only the `/auth` and `/websites*` mount block
  is retired; this file is the live entrypoint and is not going away.

**Not included** (considered, deliberately left alone): `schema/schema.sql`'s
`websites`/`pages`/`collaborators`/`subscriptions`/`ai_usage` table
definitions back the retired surface too, but weren't marked in this
pass — flagged here rather than silently touched, since dropping or
commenting a live D1 schema needs its own explicit decision, not a
side effect of an app-code cleanup.

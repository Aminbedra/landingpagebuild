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
  `AIPitchWidget` island. Fully verified live on staging: renders only
  where `aiEnabled` is true, correctly absent where it's false, 403s
  correctly when disabled, 400s correctly on a missing challenge, and —
  now that the Anthropic account has credit — returns a real generated
  pitch on `POST /api/ai/uk` (confirmed via curl with an actual
  business-challenge prompt). The earlier 503 was exactly what it was
  diagnosed as: an account-billing issue, not a code issue.

Not done: the two closed gaps above were the only ones tracked for this
phase. Nothing else outstanding — Phase 2 has no known gaps left.

---

**Phase 3 — Admin Panel: COMPLETE — deployed to both staging and production**

Copy editor, AI toggle, clone market, version history + rollback, leads
dashboard with CSV export, user management (list/create/change role) —
all built and wired to the Worker API. Session handling (30-minute
tokens with silent idle refresh) works.

Deployed to two Cloudflare Pages projects: `landingpagebuild-admin-staging`
(`landingpagebuild-admin-staging.pages.dev`) and, as of this pass,
`landingpagebuild-admin-production`
(`landingpagebuild-admin-production.pages.dev`). Production's custom
domain (`app.landingpagebuild.com`) is **not yet attached** — that's a
manual Cloudflare Dashboard step, documented in `HANDOFF.md`'s "Manual
Steps Remaining". Correction to a prior note in this file: the staging
Pages project **does** have Git integration connected
(`wrangler pages project list` → `Git Provider: Yes`) — pushing any
branch auto-deploys a preview there, pushes to `main` auto-deploy
Production. This wasn't true when earlier phases of this file were
written. Production Pages project's Git integration status is
unchecked.

One real bug caught and fixed during the production deploy: `admin/.env`
(the only env file this project has — no `.env.production`) still had
`PUBLIC_WORKER_API_URL` pointing at staging when the production build
ran. Caught before deploying (checked the built bundle, not assumed),
fixed by temporarily pointing it at production for that one build, then
restoring the staging default. `worker/src/lib/utils.ts`'s CORS
allowlist also needed a second entry
(`landingpagebuild-admin-production.pages.dev`) — the production admin
panel would otherwise have been blocked by CORS on every API call.
Both fixes are permanent (code-level for CORS, documented caveat for
the env-file gap — proper fix is follow-up work, not done here).

---

**Phase 4 — DNS Routing: COMPLETE for both environments (two manual steps remaining, see HANDOFF.md)**

Both environments now fully live and curl-verified:

- **Staging**: `api.staging.landingpagebuild.com` (Worker),
  `uk/de/fr.staging.landingpagebuild.com` (Astro),
  `landingpagebuild-admin-staging.pages.dev` (admin).
- **Production**: `api.landingpagebuild.com` (Worker),
  `uk/de/fr.landingpagebuild.com` + the bare `landingpagebuild.com` apex
  (Astro), `landingpagebuild-admin-production.pages.dev` (admin, no
  custom domain yet).

The typo domain (`landingpagbuild.com`) has no route in either
environment, per `ARCHITECTURE.md`'s "redirect-only" ruling — the actual
301 redirect rule itself is a zone-level Cloudflare action, still not
set up (not expressible via `wrangler`).

Verified end-to-end on production during this pass: Worker health
(`200`), all three market pages (`200` each), lead capture (`200`,
`{"success":true,...}`, D1 write confirmed), AI pitch (`200`, real
generated response). Two real issues were hit and fixed live, not
assumed away:

1. `wrangler deploy --env production` failed for the root Worker —
   its `wrangler.toml` has no named `[env.production]` block (unlike
   `astro/wrangler.toml`'s inverted structure — top-level there is
   staging). Corrected to plain `wrangler deploy` (top-level = production
   in that file).
2. Production D1's `leads` table was still the original Phase-1 schema
   — migrations `0002`/`0003` had only ever been applied to staging.
   Applied both to `lpb-prod-db` with `--remote` (omitting it targets a
   local emulated DB, not the real one — a second gotcha caught the
   same way as #1) and reverified via `PRAGMA table_info(leads)` before
   retrying the lead-capture test.

Still remaining (both documented in `HANDOFF.md`'s "Manual Steps
Remaining" — Dashboard-only, not CLI-expressible):
- `app.landingpagebuild.com` custom domain not attached to the
  production admin Pages project.
- `app.staging.landingpagebuild.com` CNAME not created for staging admin.

Known content gap, unchanged by this pass: the production apex
(`landingpagebuild.com`) route is live, but `marketFromHost()` has no
homepage concept — it currently serves the UK market's `config:uk`
copy, not distinct platform marketing content.

Markets seeded — production now has more complete data than staging:

| | Staging | Production |
|---|---|---|
| `markets:index` | `["uk","de","fr"]` | `["uk","de","fr"]` |
| `config:uk` / `config:de` | Set | Set |
| `config:fr` | **Not set** (placeholder fallback renders) | Set (seeded this pass) |

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
| 2 — Astro Landing Page | COMPLETE (staging) — fully verified, including a real AI pitch response |
| 3 — Admin Panel | COMPLETE — deployed to staging and production; production custom domain pending a manual step |
| 4 — DNS Routing | COMPLETE for both environments — two manual DNS/Pages-domain steps remaining, see HANDOFF.md |
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

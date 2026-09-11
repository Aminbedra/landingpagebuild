# Architecture

## What This Product Is

LandingPageBuild.com is a multi-market B2B landing page platform. One
company (or one client) manages one brand across multiple market
subdomains from a single admin panel — copy per market, an AI pitch
widget toggle per market, leads captured per market, all controlled
centrally.

This is **not** a general-purpose multi-tenant website builder. It does
not let arbitrary end users sign up, create their own sites, and manage
their own pages. There is exactly one operator (Super Admin), optionally
delegating individual markets to Client Admins or Viewers.

## Product Shape

- `landingpagebuild.com` — public Astro marketing site
- `app.landingpagebuild.com` — admin panel (Vite + React SPA)
- `api.landingpagebuild.com` — Cloudflare Worker (Hono router)
- `{market}.landingpagebuild.com` — per-market landing pages (e.g.
  `uk.landingpagebuild.com`, `de.landingpagebuild.com`)

## Stack

- **Frontend**: Astro + React Islands
- **Admin**: Vite + React SPA — a separate Cloudflare Pages project, not
  an Astro page. (Astro's Cloudflare adapter can't cleanly deploy an
  SSR project to Pages — see `astro/README.md`'s note on
  withastro/astro#16107. The admin panel is 100% client-side, so it
  doesn't need SSR or direct Cloudflare bindings at all — it talks to
  the Worker API over HTTPS like any other client.)
- **Backend**: Cloudflare Workers with the Hono router
- **Database**: D1 (primary, relational) + KV (per-market config,
  sessions/password hashes, published-copy version history, analytics
  counters)
- **AI**: Claude API via `ANTHROPIC_API_KEY` (not Cloudflare Workers AI)
- **Email**: Resend (Phase 5, wired for lead notifications and welcome
  emails)
- **Payments**: Stripe — future. `STRIPE_SECRET_KEY` /
  `STRIPE_WEBHOOK_SECRET` exist as env placeholders only. No billing
  logic is wired, and none should be built until this is explicitly
  scoped.

## What Is Retired

The `/site/[subdomain]/[...slug].astro` multi-tenant builder surface is
retired. It was an earlier architectural direction — publish a
`page:{subdomain}:{slug}` KV record per page, render it through
`SectionRenderer.astro`, and let visitors talk to a `ChatWidget`/
`LeadForm` scoped to a `websiteId` — and it has been superseded by the
market-routing model (`config:{market}`, resolved from the request's
`Host` header, rendered by `astro/src/pages/index.astro`).

**Do not build on top of it.** It will be deleted in a future cleanup
pass, along with its supporting components (`SectionRenderer.astro`,
the section templates under `astro/src/components/sections/`,
`ChatWidget.tsx`, `LeadForm.tsx` as consumed by that route). Nothing
currently publishes to the KV shape it reads, so it renders nothing in
practice today.

The Worker routes that back that surface (`/auth`, `/websites*`,
`/websites/:id/ai`, `/websites/:id/versions`) still exist in
`worker/src/routes/` and are not yet formally marked retired — they're
the backing store for the surface above and have no other consumer.
Treat them as part of the same retirement scope until a follow-up pass
confirms and removes them; don't extend them either.

## Staging vs Production

- **Production**: `landingpagebuild.com`
- **Staging**: `staging.landingpagebuild.com`
- **`landingpagbuild.com`** (the typo domain, missing the second `e`) —
  a 301 redirect to production only. It is **not** a staging
  environment, despite having been used as one in earlier phases (see
  `STATUS.md` for where that still needs to be untangled).

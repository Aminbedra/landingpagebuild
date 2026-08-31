# LandingPageBuild.com — Astro renderer

Phase 2. Server-rendered on Cloudflare, reading published page copy from
Workers KV at request time and leaning on the Worker API (`../worker`) for
everything stateful — leads and AI chat.

- **Astro 7**, `output: 'server'`, `@astrojs/cloudflare` adapter (Cloudflare
  Pages build output — `pages_build_output_dir` in `wrangler.toml`)
- **React islands** (`@astrojs/react`) for the two interactive pieces: the
  AI chat widget and the lead capture form
- **Tailwind v4** via `@tailwindcss/vite` (CSS-first config, see
  `src/styles/global.css`)

## How a page renders

`src/pages/site/[subdomain]/[...slug].astro` reads `env.KV` (via
`import { env } from 'cloudflare:workers'` — see `src/lib/kv.ts`) for a key
`page:{subdomain}:{slug}` and renders its `{ sections: [...] }` JSON through
`SectionRenderer.astro`, which maps each `section.type` (`hero`, `features`,
`testimonials`, `cta`, `contact`, `faq`, `custom`) to a component under
`src/components/sections/`. That JSON shape matches what the Worker's AI
routes already produce (`worker/src/routes/ai.ts`).

**Nothing publishes to that KV shape yet** — the Worker's D1 `pages` table is
still the source of truth (Phase 1). A publish step, presumably landing
alongside Phase 4's subdomain routing, needs to write the denormalized
`SitePageRecord` shape (`src/lib/kv.ts`) into KV. Until then, the route only
renders whatever's been put there manually — see "Try it" below for how a
demo entry was seeded.

The route path itself (`/site/{subdomain}/{slug}`) is a stand-in for real
subdomain routing (`{subdomain}.landingpagebuild.com/{slug}`), which Phase 4
owns. Astro rejects an optional catch-all (`[[...slug]]`) nested under
another dynamic segment, so a site's home page is `/site/{subdomain}/index`
rather than a bare `/site/{subdomain}`.

## React islands

- **`ChatWidget`** (`client:idle`) posts to `POST /websites/:id/ai/chat`.
  That route requires an owner JWT (`worker/src/routes/ai.ts` →
  `requireAuth`) and there's no visitor-scoped chat endpoint yet, so on a
  publicly published page this will currently surface the Worker's 401
  unless an `authToken` prop is threaded in from an authenticated context.
  Wiring a visitor-safe variant is follow-up work for whichever phase adds
  the public chat experience — not something invented here.
- **`LeadForm`** (`client:visible`, inside the `contact` section) posts to
  `POST /websites/:id/leads`, which *is* public. This required a fix to
  `worker/src/index.ts` (see below) and is deployed to staging.

Both call the Worker directly from the browser via `PUBLIC_WORKER_API_URL`
(`.env` — a public, non-secret build-time value Vite inlines into the client
bundle).

## A Worker bug this surfaced (fixed, deployed to staging)

`worker/src/index.ts` mounted `/websites` (whose sub-router applies
`requireAuth` to `'*'`) before the more specific `/websites/:websiteId/leads`
mount. Hono runs matched handlers in registration order, not by path
specificity, so that auth middleware was intercepting the public
`POST /websites/:id/leads` route before it ever reached its handler — every
lead submission was 401'ing. Reordering the mounts (specific routes before
the general `/websites` one) fixed it; verified against staging and
redeployed (`npm run deploy:staging` from the repo root).

## Dev

```bash
npm install
npm run dev            # astro dev on :3000
```

Port is pinned to `3000` in `astro.config.mjs` because the Worker's CORS
allowlist (`worker/src/lib/utils.ts`) only permits `http://localhost:3000` —
Astro's default `4321` gets silently blocked by the browser on any
cross-origin call to the Worker.

`remoteBindings: true` (adapter option) + `remote = true` (the KV binding in
`wrangler.toml`) make `astro dev` read the *real* staging KV namespace
instead of an empty local emulation — no separate KV seeding step needed for
local dev, but it does mean dev talks to live staging data.

### Try it

A demo entry was seeded into the staging KV namespace for exactly this:

```bash
npx wrangler kv key get "page:demo:index" \
  --namespace-id 3f5a4a30c4164a948a56cadd21c25d49 --remote
```

Visit `/site/demo/index` (linked from `/`) to see it rendered.

## Build / deploy

```bash
npm run build           # astro build -> dist/
npm run preview          # wrangler pages dev dist
npm run deploy            # astro build && wrangler pages deploy
```

## Known gaps / next-phase hooks

- **Publish step**: nothing writes the `page:{subdomain}:{slug}` KV shape
  yet — needs to land with the real publish flow.
- **Production KV/vars**: `wrangler.toml` only has the staging KV binding.
  Add a production KV namespace + `.env.production` once one exists.
- **Subdomain routing**: `/site/{subdomain}/{slug}` is a placeholder for
  Phase 4's `{subdomain}.landingpagebuild.com` routing.
- **Visitor-safe AI chat**: see the ChatWidget note above.
- **`custom` sections**: rendered as a formatted JSON dump rather than raw
  HTML — there's no sanitizer in front of AI-authored HTML yet.

#!/usr/bin/env bash
# Seed STAGING_KV-equivalent data for the Phase 3 admin panel.
#
# NOTE on binding name: the Phase 3 brief calls the staging namespace
# STAGING_KV, but wrangler.toml only ever declared a single `KV` binding
# whose id is swapped per environment (see [env.staging.kv_namespaces] in
# ../wrangler.toml, pointing at the lpb-staging-kv namespace). There is no
# STAGING_KV binding to target — this script writes to the real staging
# namespace via `--binding=KV --env staging`.
#
# Run from the repo root: ./scripts/seed-admin-kv.sh

set -euo pipefail
cd "$(dirname "$0")/.."

KV_FLAGS=(--binding=KV --env staging)

echo "Seeding markets:index ..."
npx wrangler kv key put "markets:index" '["uk","de","fr"]' "${KV_FLAGS[@]}"

echo "Seeding config:uk ..."
npx wrangler kv key put "config:uk" '{
  "market":"uk",
  "headline":"The B2B lead engine built for international growth",
  "subheadline":"One platform. Every market. Zero friction.",
  "body":"LandingPageBuild gives your sales team market-specific landing pages that convert, managed from a single control room. Deploy a new market in minutes, not weeks.",
  "ctaText":"Book a demo",
  "ctaUrl":"https://calendly.com/placeholder",
  "aiEnabled":true,
  "emailNotifications":true,
  "updatedAt":"2026-08-31T00:00:00.000Z",
  "updatedBy":"seed"
}' "${KV_FLAGS[@]}"

echo "Seeding config:de ..."
npx wrangler kv key put "config:de" '{
  "market":"de",
  "headline":"Die B2B-Lead-Maschine für internationales Wachstum",
  "subheadline":"Eine Plattform. Jeder Markt. Kein Aufwand.",
  "body":"Placeholder DE body copy.",
  "ctaText":"Demo buchen",
  "ctaUrl":"https://calendly.com/placeholder",
  "aiEnabled":false,
  "emailNotifications":true,
  "updatedAt":"2026-08-31T00:00:00.000Z",
  "updatedBy":"seed"
}' "${KV_FLAGS[@]}"

echo "Seeding leads:uk:1725100000000 (with AI summary) ..."
npx wrangler kv key put "leads:uk:1725100000000" '{
  "name":"Sarah Chen",
  "email":"sarah.chen@globaltech.io",
  "message":"We are expanding into the UK market and need localised landing pages for three product lines. Can you help us manage this at scale?",
  "market":"uk",
  "subdomain":"uk.landingpagebuild.com",
  "submittedAt":"2026-08-31T10:00:00.000Z",
  "aiSummary":"Visitor is a marketing manager at a mid-size tech firm. Primary challenge is multi-product, multi-market landing page management. Interested in the clone market feature and admin panel access for her team."
}' "${KV_FLAGS[@]}"

echo "Seeding leads:uk:1725110000000 (no AI summary) ..."
npx wrangler kv key put "leads:uk:1725110000000" '{
  "name":"Marcus Webb",
  "email":"m.webb@infracore.co.uk",
  "message":"Quick question — can we white-label the platform for our agency clients?",
  "market":"uk",
  "subdomain":"uk.landingpagebuild.com",
  "submittedAt":"2026-08-31T12:45:00.000Z"
}' "${KV_FLAGS[@]}"

echo "Seeding leads:de:1725120000000 (with AI summary) ..."
npx wrangler kv key put "leads:de:1725120000000" '{
  "name":"Lena Hoffmann",
  "email":"lena@baumhaus-digital.de",
  "message":"Wir suchen eine Losung fur unsere deutschen Kampagnenseiten. Gibt es eine Testphase?",
  "market":"de",
  "subdomain":"de.landingpagebuild.com",
  "submittedAt":"2026-08-31T15:20:00.000Z",
  "aiSummary":"German-speaking visitor, agency context. Asked about trial/pricing. AI responded with platform overview and suggested booking a demo call."
}' "${KV_FLAGS[@]}"

echo "Done. Note: 'fr' is listed in markets:index but has no config:fr yet —"
echo "GET /api/admin/config/fr will 404 until it's saved once from the admin panel."
echo
echo "To reach the admin panel you also need a super_admin user (the panel"
echo "reuses the existing internal JWT auth, gated by requireSuperAdmin):"
echo "  1. POST \$WORKER_URL/auth/register with { email, password } — this"
echo "     always creates a 'client_admin' account."
echo "  2. Promote it to super_admin in D1:"
echo "     npx wrangler d1 execute lpb-staging-db --env staging --remote \\"
echo "       --command \"UPDATE users SET role = 'super_admin' WHERE email = 'you@example.com'\""
echo "  3. Log in at /admin with that email/password."

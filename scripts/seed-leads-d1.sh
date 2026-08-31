#!/usr/bin/env bash
# Seed test leads directly into D1's `leads` table (staging) — the data
# originally seeded into leads:{market}:{timestamp} KV keys by
# scripts/seed-admin-kv.sh, now migrated onto the D1 schema from
# worker/migrations/0002_leads_market_schema.sql.
#
# Run from the repo root: ./scripts/seed-leads-d1.sh

set -euo pipefail
cd "$(dirname "$0")/.."

DB_FLAGS=(lpb-staging-db --env staging --remote)

echo "Seeding seed-lead-001 (uk, with AI summary) ..."
npx wrangler d1 execute "${DB_FLAGS[@]}" --command "
INSERT OR IGNORE INTO leads (id, website_id, market, subdomain, name, email, message, ai_summary, submitted_at)
VALUES (
  'seed-lead-001', NULL, 'uk', 'uk.landingpagebuild.com',
  'Sarah Chen', 'sarah.chen@globaltech.io',
  'We are expanding into the UK market and need localised landing pages for three product lines. Can you help us manage this at scale?',
  'Visitor is a marketing manager at a mid-size tech firm. Primary challenge is multi-product, multi-market landing page management. Interested in the clone market feature and admin panel access for her team.',
  '2026-08-31T10:00:00.000Z'
);
"

echo "Seeding seed-lead-002 (uk, no AI summary) ..."
npx wrangler d1 execute "${DB_FLAGS[@]}" --command "
INSERT OR IGNORE INTO leads (id, website_id, market, subdomain, name, email, message, ai_summary, submitted_at)
VALUES (
  'seed-lead-002', NULL, 'uk', 'uk.landingpagebuild.com',
  'Marcus Webb', 'm.webb@infracore.co.uk',
  'Quick question -- can we white-label the platform for our agency clients?',
  NULL,
  '2026-08-31T12:45:00.000Z'
);
"

echo "Seeding seed-lead-003 (de, with AI summary) ..."
npx wrangler d1 execute "${DB_FLAGS[@]}" --command "
INSERT OR IGNORE INTO leads (id, website_id, market, subdomain, name, email, message, ai_summary, submitted_at)
VALUES (
  'seed-lead-003', NULL, 'de', 'de.landingpagebuild.com',
  'Lena Hoffmann', 'lena@baumhaus-digital.de',
  'Wir suchen eine Loesung fuer unsere deutschen Kampagnenseiten. Gibt es eine Testphase?',
  'German-speaking visitor, agency context. Asked about trial/pricing. AI responded with platform overview and suggested booking a demo call.',
  '2026-08-31T15:20:00.000Z'
);
"

echo "Done. Verify with:"
echo "  npx wrangler d1 execute lpb-staging-db --env staging --remote \\"
echo "    --command \"SELECT id, market, name, email FROM leads ORDER BY submitted_at DESC;\""

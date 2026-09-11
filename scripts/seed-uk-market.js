#!/usr/bin/env node
// Priority 2, Part A, Step 1 — seeds config:uk with LandingPageBuild's
// real go-to-market copy for the UK market.
//
// Staging only today (see ENV_FLAGS below) — per the account's own rule
// ("never touch production until staging is confirmed working") and this
// pass's explicit staging-first scope. Do not point this at PROD_KV
// without separate, explicit sign-off.
//
// Two deliberate departures from the brief's literal JSON, both checked
// against the live system rather than assumed:
//
// 1. Flat fields, not nested `copy: {...}`. The brief's shape doesn't
//    match MarketConfig (worker/src/routes/admin.ts,
//    astro/src/lib/marketConfig.ts) — the live system reads
//    config.headline/config.ctaText/etc. directly, not
//    config.copy.headline. Writing the brief's literal nested shape
//    would silently show placeholder/fallback content on the live page
//    (config?.headline would be undefined) instead of this copy — the
//    opposite of what "stand up UK" is asking for. This script writes
//    the flat shape the live system actually reads.
// 2. Merges onto whatever's already saved at config:uk instead of
//    replacing it outright — same convention PUT /api/admin/config/:market
//    already uses. The brief's JSON has no heroImageUrl/stylePreset, and
//    config:uk currently has a heroImageUrl set via the admin panel's
//    Media Library — a bare overwrite would silently drop it. A version
//    snapshot is written first too, the same "every save gets a version"
//    guarantee every other write path here already gives you, so this
//    is recoverable via the admin panel's History panel if needed.
//
// `subdomain` and `hubspotEnabled` from the brief's JSON aren't read by
// any code in this repo today (grepped worker/src and astro/src — no
// hits) — written anyway, inert, so a future pass that wires them up
// finds real data waiting.
//
// Run: node scripts/seed-uk-market.js

import { spawnSync } from 'node:child_process'

// Flip only with explicit sign-off — see the module comment above.
const ENV_FLAGS = ['--binding=KV', '--env', 'staging']

const MARKET = 'uk'
const CONFIG_KEY = `config:${MARKET}`
const versionKey = () => `versions:${MARKET}:${Date.now()}`

// ctaUrl wasn't supplied by the brief — there's no real CTA destination
// yet for "See How It Works" — so this uses the same placeholder
// convention every other seeded market's ctaUrl already uses
// (scripts/seed-admin-kv.sh's Calendly placeholder). Replace it with a
// real URL before this market is shown to real visitors.
const NEW_COPY = {
  headline: 'Win More B2B Clients Across Markets',
  subheadline:
    'Personalised landing pages per market, AI-powered pitches, and full lead intelligence — all from one admin panel.',
  ctaText: 'See How It Works',
  ctaUrl: 'https://calendly.com/placeholder', // TODO: real CTA destination
  body:
    'LandingPageBuild.com helps B2B marketers run multi-market campaigns without the overhead. One platform, every market, full control.',
  aiEnabled: true,
  emailNotifications: false,
}

// Inert today (see module comment) — kept for forward compatibility.
const EXTRA_FIELDS = {
  subdomain: 'uk.landingpagebuild.com',
  hubspotEnabled: false,
}

function wrangler(args, { allowFailure = false } = {}) {
  const result = spawnSync('npx', ['wrangler', ...args], { encoding: 'utf8' })
  if (result.status !== 0 && !allowFailure) {
    console.error(result.stdout)
    console.error(result.stderr)
    throw new Error(`wrangler ${args.join(' ')} failed (exit ${result.status})`)
  }
  return result
}

function main() {
  console.log(`Reading existing ${CONFIG_KEY} (staging) ...`)
  const getResult = wrangler(['kv', 'key', 'get', CONFIG_KEY, ...ENV_FLAGS], { allowFailure: true })

  let existing = {}
  if (getResult.status === 0 && getResult.stdout.trim()) {
    try {
      existing = JSON.parse(getResult.stdout)
      console.log('Found existing config — merging onto it (heroImageUrl/stylePreset/etc. preserved).')
    } catch {
      console.warn('Existing value was not valid JSON — starting fresh instead of merging onto it.')
    }
  } else {
    console.log('No existing config:uk — creating new.')
  }

  const merged = {
    market: MARKET,
    ...existing,
    ...NEW_COPY,
    ...EXTRA_FIELDS,
    updatedAt: new Date().toISOString(),
    updatedBy: 'scripts/seed-uk-market.js',
  }

  const json = JSON.stringify(merged)

  console.log('Writing version snapshot ...')
  wrangler(['kv', 'key', 'put', versionKey(), json, ...ENV_FLAGS])

  console.log(`Writing ${CONFIG_KEY} ...`)
  wrangler(['kv', 'key', 'put', CONFIG_KEY, json, ...ENV_FLAGS])

  console.log('\nDone. Verify with:')
  console.log(`  npx wrangler kv key get "${CONFIG_KEY}" ${ENV_FLAGS.join(' ')}`)
}

main()

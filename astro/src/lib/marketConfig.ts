// Market copy storage convention shared with the admin panel (Phase 3) —
// mirrors MarketConfig in worker/src/routes/admin.ts. `marketFromHost`
// generalizes worker/src/routes/leads.ts's deriveMarketAndSubdomain (built
// during the Part 3.5 D1 migration) to whitelist against multiple base
// domains — same reasoning as that file's own comment: a blacklist of
// "known non-market hosts" is exactly the class of bug that one already
// had (missed *.workers.dev) and got fixed by whitelisting instead.

export interface MarketConfig {
  market: string
  headline: string
  subheadline: string
  body: string
  ctaText: string
  ctaUrl: string
  aiEnabled: boolean
  emailNotifications: boolean
  // Phase 6 — set via the admin panel's Media Library "Set as hero" action.
  heroImageUrl?: string
  // Phase 8 — preset id from lib/presets.ts; absent means 'classic'.
  stylePreset?: string
  updatedAt: string
  updatedBy: string
  restoredFrom?: string
}

// Priority 2, Part A, Step 3 — landingpagbuild.com (the typo domain)
// removed from this list. Per ARCHITECTURE.md, it's a 301-redirect-to-
// production domain only, not a market-serving one; astro/wrangler.toml's
// Custom Domain routes for it were removed in the same change.
//
// staging.landingpagebuild.com must be its own explicit entry, not
// assumed to fall out of the bare landingpagebuild.com one below: for a
// host like uk.staging.landingpagebuild.com, matching against
// "landingpagebuild.com" alone would compute sub = "uk.staging" (two
// labels), fail the single-label /^[a-z0-9-]+$/ check, and silently fall
// back to DEFAULT_MARKET for every market except uk (uk only "worked" by
// accident, since it happens to equal the fallback). The loop below tries
// every base in order and only returns on a validated match, so having
// both entries here is what makes uk.staging.* and (eventually)
// uk.landingpagebuild.com both resolve correctly.
const BASE_DOMAINS = ['staging.landingpagebuild.com', 'landingpagebuild.com']

const DEFAULT_MARKET = 'uk'

export function marketFromHost(host: string | null): string {
  if (!host) return DEFAULT_MARKET
  const hostname = host.split(':')[0].toLowerCase()

  for (const base of BASE_DOMAINS) {
    if (hostname.endsWith(`.${base}`)) {
      const sub = hostname.slice(0, -(base.length + 1))
      if (sub && /^[a-z0-9-]+$/.test(sub)) return sub
    }
  }
  // No matching base domain, or no subdomain prefix (bare root domain,
  // localhost, a *.pages.dev / *.workers.dev preview host) — fall back to
  // a real market rather than a placeholder "default" one, since this is
  // what a visitor actually sees rendered.
  return DEFAULT_MARKET
}

export function marketConfigKey(market: string): string {
  return `config:${market}`
}

export async function getMarketConfig(kv: KVNamespace, market: string): Promise<MarketConfig | null> {
  return kv.get<MarketConfig>(marketConfigKey(market), 'json')
}

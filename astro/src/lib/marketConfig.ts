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
  updatedAt: string
  updatedBy: string
  restoredFrom?: string
}

// "landingpagbuild.com" (missing the second 'e') is the staging domain
// name given for this phase — kept even though nothing before this pass
// ever referenced it (every other staging reference in this repo is
// staging.landingpagebuild.com) and it hasn't been verified as an actual
// zone in this Cloudflare account. See the DNS/deploy write-up delivered
// alongside this change for why no DNS work happened yet.
const BASE_DOMAINS = ['landingpagbuild.com', 'landingpagebuild.com']

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

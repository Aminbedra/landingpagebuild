// Native pageview tracking (Phase 7) — no external analytics service.
// Fire-and-forget from the landing page's SSR frontmatter via waitUntil()
// (cloudflare:workers) rather than a bare unawaited promise: without
// waitUntil, the Workers runtime is free to cancel a still-pending
// promise once the response is fully sent, silently dropping the write
// under load. See index.astro for the call site — confirmed waitUntil is
// actually exported by this adapter's cloudflare:workers module (it sits
// right next to `env`) before relying on it here.

const PAGEVIEW_TTL_SECONDS = 90 * 24 * 60 * 60 // 90 days
const DATE_INDEX_TTL_SECONDS = 91 * 24 * 60 * 60 // one day longer than the counters it indexes

const BOT_UA_PATTERN = /bot|crawler|spider|curl|wget|python|go-http/i

export function isBotRequest(userAgent: string | null): boolean {
  if (!userAgent) return true // no UA at all isn't a real browser either
  return BOT_UA_PATTERN.test(userAgent)
}

function pageviewKey(market: string, date: string): string {
  return `analytics:pageviews:${market}:${date}`
}

function dateIndexKey(market: string): string {
  return `analytics:dates:${market}`
}

async function incrementPageview(kv: KVNamespace, market: string, date: string): Promise<void> {
  const key = pageviewKey(market, date)
  const current = await kv.get(key)
  const next = (parseInt(current ?? '0', 10) + 1).toString()
  await kv.put(key, next, { expirationTtl: PAGEVIEW_TTL_SECONDS })
}

async function ensureDateIndexed(kv: KVNamespace, market: string, date: string): Promise<void> {
  const key = dateIndexKey(market)
  const raw = await kv.get(key)
  const dates: string[] = raw ? JSON.parse(raw) : []
  if (dates.includes(date)) return
  dates.push(date)
  dates.sort()
  await kv.put(key, JSON.stringify(dates.slice(-90)), { expirationTtl: DATE_INDEX_TTL_SECONDS })
}

// Must never throw — analytics can never break page rendering. Passed
// straight to waitUntil() by the caller, so a rejection here would only
// ever surface as a background unhandled-rejection, never a broken
// response — but swallowing it explicitly keeps that guarantee obvious
// rather than incidental.
export async function recordPageview(kv: KVNamespace, market: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10)
  try {
    await Promise.all([incrementPageview(kv, market, today), ensureDateIndexed(kv, market, today)])
  } catch {
    // KV write failed — drop it silently, exactly as intended.
  }
}

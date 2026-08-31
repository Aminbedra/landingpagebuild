// Page-copy storage convention for the Astro renderer.
//
// The Worker (Phase 1) keeps the source of truth for page content in D1
// (`pages.content`, a JSON string shaped `{ sections: [...] }` — see
// worker/src/routes/ai.ts and worker/src/routes/pages.ts). Publishing a
// website is expected to write a denormalized copy into this KV namespace
// so the Astro renderer never has to touch D1 on the request path.
//
// Key: `page:{subdomain}:{slug}`  — `slug` is "index" for a site's root page.
// A future publish step (Phase 4, alongside subdomain routing) is what
// should populate these keys; nothing in Phase 1 writes them yet.

export interface PageSection {
  type: 'hero' | 'features' | 'testimonials' | 'cta' | 'contact' | 'faq' | 'custom'
  content: Record<string, unknown>
}

export interface PageContent {
  sections: PageSection[]
}

export interface SitePageRecord {
  website: {
    id: string
    name: string
    description: string | null
    subdomain: string
  }
  page: {
    id: string
    name: string
    slug: string
    content: PageContent
  }
  updated_at: string
}

export function pageKey(subdomain: string, slug: string): string {
  return `page:${subdomain}:${slug || 'index'}`
}

export async function getPageFromKV(
  kv: KVNamespace,
  subdomain: string,
  slug: string
): Promise<SitePageRecord | null> {
  const record = await kv.get<SitePageRecord>(pageKey(subdomain, slug), 'json')
  return record ?? null
}

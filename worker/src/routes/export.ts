import { Hono } from 'hono'
import { zipSync, strToU8 } from 'fflate'
import type { Env, JwtPayload } from '../types'
import { requireSuperAdmin } from '../middleware/requireAuth'
import {
  buildAstroConfig,
  buildPackageJson,
  buildEnvExample,
  buildReadme,
  buildIndexAstro,
  buildAIPitchWidget,
  buildLeadForm,
  type ExportConfig,
} from '../lib/exportTemplates'

// ── Priority 2, Part B — one-click site export ────────────────────────────────
//
// GET /api/export/:market — admin auth required (requireSuperAdmin, same
// gate as every other /api/admin/* route, even though this one isn't
// mounted under that prefix — see worker/src/index.ts's mount comment).
// Bundles a standalone Astro project for the market: the copy currently
// saved in config:{market} baked in as static defaults (no KV/SSR
// dependency), plus the same AIPitchWidget/LeadForm islands the live page
// uses, verbatim (see lib/exportTemplates.ts for why they're embedded via
// JSON.stringify rather than hand-copied). The customer takes this
// wherever they like — it has nothing Cloudflare- or LandingPageBuild-
// specific baked in beyond the one env var pointing back at the Worker API.
//
// Zipped with fflate (pure JS, no Node builtins) — Workers have no
// filesystem, so this can't shell out to a real `zip` binary or write
// temp files; the whole archive is built and returned in memory.

const exportRoutes = new Hono<{ Bindings: Env; Variables: { jwtPayload: JwtPayload } }>()

exportRoutes.use('*', requireSuperAdmin)

const MARKET_SLUG_RE = /^[a-z0-9-]+$/

// GET /api/export/:market
exportRoutes.get('/:market', async (c) => {
  const market = c.req.param('market')
  if (!MARKET_SLUG_RE.test(market)) {
    return c.json({ error: 'Invalid market' }, 400)
  }

  const config = await c.env.KV.get<ExportConfig>(`config:${market}`, 'json')
  if (!config) return c.json({ error: 'Market not found' }, 404)

  const files: Record<string, Uint8Array> = {
    'astro.config.mjs': strToU8(buildAstroConfig()),
    'package.json': strToU8(buildPackageJson(market)),
    '.env.example': strToU8(buildEnvExample()),
    'README.md': strToU8(buildReadme()),
    'src/pages/index.astro': strToU8(buildIndexAstro(market, config)),
    'src/components/AIPitchWidget.tsx': strToU8(buildAIPitchWidget()),
    'src/components/LeadForm.tsx': strToU8(buildLeadForm()),
  }

  let zipped: Uint8Array
  try {
    zipped = zipSync(files, { level: 6 })
  } catch (e) {
    console.error('Failed to build export zip:', e)
    return c.json({ error: 'Could not build the export. Please try again.' }, 500)
  }

  return new Response(zipped, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="landingpagebuild-${market}.zip"`,
      'Content-Length': String(zipped.byteLength),
    },
  })
})

export default exportRoutes

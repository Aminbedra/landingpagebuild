import { Hono } from 'hono'
import type { Env, JwtPayload } from '../types'
import type { AppContext } from '../middleware/requireAuth'
import { requireAuth } from '../middleware/requireAuth'
import { generateId, ok, err, now } from '../lib/utils'

const ai = new Hono<AppContext>()

ai.use('*', requireAuth)

const PLAN_LIMITS: Record<string, number> = {
  free: 10,
  basic: 100,
  pro: 300,
  agency: 1000,
}

async function ownedWebsite(env: Env, user: JwtPayload, websiteId: string) {
  const website = await env.DB.prepare('SELECT * FROM websites WHERE id = ?')
    .bind(websiteId)
    .first<{ user_id: string; plan: string; name: string; description: string | null }>()
  if (!website) return null
  if (user.role !== 'super_admin' && website.user_id !== user.sub) return null
  return website
}

// POST /websites/:websiteId/ai/chat
ai.post('/chat', async (c) => {
  const user = c.get('jwtPayload')
  const websiteId = c.req.param('websiteId') as string

  const website = await ownedWebsite(c.env, user, websiteId)
  if (!website) return err('Website not found or access denied', 404)

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const usageRow = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM ai_usage WHERE website_id = ? AND created_at >= ?"
  ).bind(websiteId, monthStart.toISOString()).first<{ count: number }>()

  const used = usageRow?.count ?? 0
  const limit = PLAN_LIMITS[website.plan] ?? 10

  if (used >= limit) {
    return err(`AI edit limit reached (${used}/${limit} this month). Upgrade your plan for more.`, 429)
  }

  const body = await c.req.json<{
    message: string
    page_id?: string
    current_content?: string
    history?: Array<{ role: 'user' | 'assistant'; content: string }>
  }>()

  if (!body.message?.trim()) return err('Message is required', 400)

  let pageContext = ''
  if (body.page_id) {
    const page = await c.env.DB.prepare(
      'SELECT name, slug, content FROM pages WHERE id = ? AND website_id = ?'
    ).bind(body.page_id, websiteId).first<{ name: string; slug: string; content: string | null }>()
    if (page) {
      pageContext = `\nCurrent page: "${page.name}" (/${page.slug})\nCurrent content:\n${page.content ?? '(empty)'}`
    }
  }

  const systemPrompt = `You are an expert web designer and copywriter helping build landing pages for "${website.name}".
Business description: ${website.description ?? 'Not provided'}
${pageContext}

When the user asks you to make changes, respond with:
1. A brief confirmation of what you changed (1-2 sentences)
2. The complete updated page content as a JSON object with this structure:
{"sections": [{"type": "hero|features|testimonials|cta|contact|custom", "content": {...}}]}

If the user is just asking a question, answer helpfully without returning JSON.
Always maintain the existing structure unless asked to change it.`

  const messages = [
    ...(body.history ?? []),
    { role: 'user' as const, content: body.message },
  ]

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': c.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    }),
  })

  if (!response.ok) {
    console.error('Anthropic API error:', await response.text())
    return err('AI service temporarily unavailable', 503)
  }

  const aiResponse = await response.json<{ content: Array<{ type: string; text: string }> }>()
  const text = aiResponse.content.find(b => b.type === 'text')?.text ?? ''

  await c.env.DB.prepare(
    'INSERT INTO ai_usage (id, website_id, user_id, action, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(generateId(), websiteId, user.sub, 'chat', now()).run()

  let updatedContent: unknown = null
  const jsonMatch = text.match(/\{[\s\S]*"sections"[\s\S]*\}/)
  if (jsonMatch && body.page_id) {
    try {
      updatedContent = JSON.parse(jsonMatch[0])
      await c.env.DB.prepare(
        'UPDATE pages SET content = ?, updated_at = ? WHERE id = ? AND website_id = ?'
      ).bind(JSON.stringify(updatedContent), now(), body.page_id, websiteId).run()
    } catch {
      // Conversational response, no JSON to save
    }
  }

  return ok({ message: text, updated_content: updatedContent, usage: { used: used + 1, limit } })
})

// POST /websites/:websiteId/ai/generate
ai.post('/generate', async (c) => {
  const user = c.get('jwtPayload')
  const websiteId = c.req.param('websiteId') as string

  const website = await ownedWebsite(c.env, user, websiteId)
  if (!website) return err('Website not found or access denied', 404)

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': c.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: `You are a professional web designer. Generate a complete multi-page website structure.
Return ONLY raw JSON — no explanation, no markdown — with this structure:
{
  "pages": [
    {
      "name": "Page Name",
      "slug": "page-slug",
      "sort_order": 0,
      "content": {
        "sections": [{"type": "hero|features|testimonials|cta|contact|faq|custom", "content": {...}}]
      }
    }
  ]
}
Generate 6-10 pages. Always include: Home, About, Contact, and a pricing or services page.`,
      messages: [{
        role: 'user',
        content: `Business name: ${website.name}\nBusiness description: ${website.description ?? 'A professional business'}`,
      }],
    }),
  })

  if (!response.ok) return err('AI service temporarily unavailable', 503)

  const aiResponse = await response.json<{ content: Array<{ type: string; text: string }> }>()
  const text = aiResponse.content.find(b => b.type === 'text')?.text ?? ''

  let generated: { pages: Array<{ name: string; slug: string; sort_order: number; content: unknown }> }
  try {
    generated = JSON.parse(text)
  } catch {
    return err('Failed to parse generated site structure', 500)
  }

  const timestamp = now()
  const createdPages = []

  for (const page of generated.pages) {
    const id = generateId()
    await c.env.DB.prepare(
      `INSERT INTO pages (id, website_id, name, slug, content, is_published, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`
    ).bind(id, websiteId, page.name, page.slug, JSON.stringify(page.content), page.sort_order, timestamp, timestamp).run()
    createdPages.push({ id, name: page.name, slug: page.slug })
  }

  await c.env.DB.prepare(
    'INSERT INTO ai_usage (id, website_id, user_id, action, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(generateId(), websiteId, user.sub, 'generate', now()).run()

  return ok({ pages_created: createdPages.length, pages: createdPages }, 201)
})

export default ai

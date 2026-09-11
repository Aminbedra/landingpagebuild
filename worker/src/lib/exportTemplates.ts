// Templates for GET /api/export/:market (routes/export.ts) — generates a
// standalone Astro project a customer can take to their own Vercel or
// Cloudflare Pages account. Workers have no filesystem, so these are
// plain template-string generators, not real files on disk.
//
// AI_PITCH_WIDGET_SRC / LEAD_FORM_SRC are embedded verbatim from the live
// astro/src/components/market/*.tsx files via JSON.stringify (safely
// escapes every backtick/${...}/quote in the source) rather than
// hand-transcribed, so the exported islands are guaranteed byte-identical
// to what the live market page actually ships. Keep these two components
// in sync by re-generating this file if either ever changes — see the
// (discarded) generator script noted in the PR that introduced this file.

export interface ExportConfig {
  headline?: string
  subheadline?: string
  body?: string
  ctaText?: string
  ctaUrl?: string
  aiEnabled?: boolean
  heroImageUrl?: string
}

// JSON.stringify doubles as a safe JS string-literal encoder — handles
// quotes/backticks/newlines/unicode in market copy without any manual
// escaping, the same trick astro/src/pages/index.astro's generated
// frontmatter below relies on.
function jsLiteral(value: string): string {
  return JSON.stringify(value)
}

export function buildAstroConfig(): string {
  return `import { defineConfig } from 'astro/config'
import react from '@astrojs/react'

// Static export — no SSR, no Cloudflare bindings. The two islands below
// call your Worker API directly over HTTPS using PUBLIC_WORKER_API_URL
// (see .env.example), so this project has nothing platform-specific in
// it — deploy it to Vercel, Cloudflare Pages, Netlify, or anywhere else
// that serves a static Astro build.
export default defineConfig({
  integrations: [react()],
})
`
}

export function buildPackageJson(market: string): string {
  const pkg = {
    name: `landingpagebuild-export-${market}`,
    version: '1.0.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'astro dev',
      build: 'astro build',
      preview: 'astro preview',
    },
    dependencies: {
      astro: '^7.2.9',
      '@astrojs/react': '^6.0.4',
      react: '^19.2.8',
      'react-dom': '^19.2.8',
    },
    devDependencies: {
      '@types/react': '^19.2.18',
      '@types/react-dom': '^19.2.5',
      typescript: '^5.5.0',
    },
  }
  return JSON.stringify(pkg, null, 2) + '\n'
}

export function buildEnvExample(): string {
  return `# Point this at your LandingPageBuild Worker API so the AI pitch
# widget and lead form keep working after export. Ask whoever manages
# your LandingPageBuild account for the right URL.
PUBLIC_WORKER_API_URL=https://api.landingpagebuild.com
`
}

export function buildReadme(): string {
  return `# Your LandingPageBuild Export

This is your exported LandingPageBuild site.

Deploy to Vercel: push to GitHub and connect to Vercel.
Deploy to Cloudflare Pages: run \`wrangler pages deploy dist/\` after \`npm run build\`.

## Before you deploy

1. \`npm install\`
2. Copy \`.env.example\` to \`.env\` and set \`PUBLIC_WORKER_API_URL\` — this
   is what the AI pitch widget and lead form talk to. Without it, both
   will fail to submit.
3. \`npm run build\` — outputs a static site to \`dist/\`.

## What's in here

- \`src/pages/index.astro\` — your market page, with the copy you had
  saved in the admin panel baked in as static defaults. Edit it directly
  if you want to change anything after export — this copy no longer
  syncs with the LandingPageBuild admin panel.
- \`src/components/AIPitchWidget.tsx\`, \`src/components/LeadForm.tsx\` —
  the same two interactive pieces from your live page, calling your
  Worker API directly. Self-contained — no other project files needed.
`
}

export function buildIndexAstro(market: string, config: ExportConfig): string {
  const headline = config.headline ?? 'Welcome'
  const subheadline = config.subheadline ?? ''
  const body = config.body ?? ''
  const ctaText = config.ctaText ?? 'Get started'
  const ctaUrl = config.ctaUrl ?? '#'
  const aiEnabled = config.aiEnabled ?? false
  const heroImageUrl = config.heroImageUrl ?? null

  return `---
// Exported from LandingPageBuild — this copy is a static snapshot as of
// export time, not KV-dependent. Edit freely; it will not sync back to
// the admin panel.
import AIPitchWidget from '../components/AIPitchWidget'
import LeadForm from '../components/LeadForm'

const market = ${jsLiteral(market)}
const headline = ${jsLiteral(headline)}
const subheadline = ${jsLiteral(subheadline)}
const body = ${jsLiteral(body)}
const ctaText = ${jsLiteral(ctaText)}
const ctaUrl = ${jsLiteral(ctaUrl)}
const aiEnabled = ${aiEnabled ? 'true' : 'false'}
const heroImageUrl = ${heroImageUrl ? jsLiteral(heroImageUrl) : 'null'}
const apiUrl = import.meta.env.PUBLIC_WORKER_API_URL
---

<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{headline}</title>
    {subheadline && <meta name="description" content={subheadline} />}
  </head>
  <body>
    <div class="page-shell">
      {heroImageUrl && (
        <div class="hero-image-wrapper">
          <img src={heroImageUrl} alt={headline} class="hero-image" />
        </div>
      )}
      <main class="content">
        <p class="eyebrow">{market.toUpperCase()}</p>
        <h1 class="headline">{headline}</h1>
        {subheadline && <p class="subheadline">{subheadline}</p>}
        {body && <p class="body-copy">{body}</p>}
        <a href={ctaUrl} class="cta-button">{ctaText}</a>

        {aiEnabled && <AIPitchWidget client:visible market={market} aiEnabled={aiEnabled} apiUrl={apiUrl} />}
        <LeadForm client:visible market={market} apiUrl={apiUrl} />
      </main>
    </div>
  </body>
</html>

<style>
  body { margin: 0; min-height: 100vh; background: #ffffff; color: #374151; font-family: system-ui, sans-serif; }
  .hero-image-wrapper { width: 100%; max-height: 480px; overflow: hidden; }
  .hero-image { width: 100%; height: 100%; max-height: 480px; object-fit: cover; display: block; }
  .content { max-width: 48rem; margin-inline: auto; padding: 6rem 1.5rem; text-align: center; }
  .eyebrow { margin: 0; font-size: 0.875rem; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; color: #6b7280; }
  .headline { margin: 0.5rem 0 0; font-size: 2.25rem; line-height: 1.15; font-weight: 700; color: #111827; }
  .subheadline { margin: 1rem 0 0; font-size: 1.125rem; color: #6b7280; }
  .body-copy { margin: 1.5rem 0 0; white-space: pre-wrap; color: #374151; }
  .cta-button { display: inline-block; margin-top: 2rem; padding: 0.75rem 1.5rem; border-radius: 6px; background: #4f46e5; color: #fff; font-size: 0.875rem; font-weight: 600; text-decoration: none; }
</style>
`
}

// Embedded verbatim from astro/src/components/market/AIPitchWidget.tsx —
// see the file-header comment above for why (JSON.stringify, not hand
// transcription).
const AI_PITCH_WIDGET_SRC = "import { useState, type SyntheticEvent } from 'react'\n\n// ── Phase 2 (Priority 1) — visitor-facing AI pitch widget ────────────────────\n//\n// Lives under components/market/ deliberately separate from the top-level\n// ChatWidget.tsx, which belongs to the retired multi-tenant builder\n// surface (see ARCHITECTURE.md \"What Is Retired\") and needs a websiteId\n// this page doesn't have. This component calls the new public\n// POST /api/ai/:market (worker/src/routes/publicAi.ts) instead — no auth,\n// gated server-side by the market's aiEnabled flag.\n//\n// Hands its result to LeadForm.tsx (a separate React island — Astro\n// hydrates each `client:*` component independently, so there's no shared\n// React tree to pass props through) via sessionStorage + a same-tab\n// CustomEvent. See LeadForm.tsx for the consuming side.\n\ninterface AIPitchWidgetProps {\n  market: string\n  aiEnabled: boolean\n  apiUrl: string\n}\n\nexport interface PitchDetail {\n  challenge: string\n  pitch: string\n}\n\nconst MAX_CHALLENGE_LENGTH = 500\nexport const AI_PITCH_EVENT = 'lpb:ai-pitch'\nexport const pitchStorageKey = (market: string) => `lpb:aiPitch:${market}`\n\ntype Status = 'idle' | 'sending' | 'error'\n\nexport default function AIPitchWidget({ market, aiEnabled, apiUrl }: AIPitchWidgetProps) {\n  const [challenge, setChallenge] = useState('')\n  const [pitch, setPitch] = useState<string | null>(null)\n  const [status, setStatus] = useState<Status>('idle')\n  const [error, setError] = useState<string | null>(null)\n\n  // index.astro only renders this island at all when aiEnabled is true —\n  // this is a second, defensive guard in case that ever changes, so the\n  // widget can never call a market whose AI is actually off.\n  if (!aiEnabled) return null\n\n  async function handleSubmit(e: SyntheticEvent) {\n    e.preventDefault()\n    const trimmed = challenge.trim()\n    if (!trimmed || status === 'sending') return\n\n    setStatus('sending')\n    setError(null)\n    setPitch(null)\n\n    try {\n      const res = await fetch(`${apiUrl}/api/ai/${encodeURIComponent(market)}`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ challenge: trimmed }),\n      })\n      const json = (await res.json()) as { pitch?: string; error?: string }\n      if (!res.ok || !json.pitch) {\n        throw new Error(json.error ?? 'Something went wrong. Please try again.')\n      }\n\n      setPitch(json.pitch)\n      setStatus('idle')\n\n      const detail: PitchDetail = { challenge: trimmed, pitch: json.pitch }\n      try {\n        sessionStorage.setItem(pitchStorageKey(market), JSON.stringify(detail))\n      } catch {\n        // Private browsing / storage disabled — the widget still works,\n        // LeadForm just won't auto-populate from it.\n      }\n      window.dispatchEvent(new CustomEvent<PitchDetail>(AI_PITCH_EVENT, { detail }))\n    } catch (err) {\n      setStatus('error')\n      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')\n    }\n  }\n\n  return (\n    <div className=\"ai-pitch-widget\">\n      <h2 className=\"ai-pitch-widget__title\">Get a tailored pitch</h2>\n      <p className=\"ai-pitch-widget__subtitle\">Describe your biggest marketing challenge</p>\n\n      <form onSubmit={handleSubmit}>\n        <textarea\n          value={challenge}\n          onChange={(e) => setChallenge(e.target.value.slice(0, MAX_CHALLENGE_LENGTH))}\n          rows={4}\n          maxLength={MAX_CHALLENGE_LENGTH}\n          placeholder=\"e.g. We're launching in a new market and don't know how to stand out...\"\n          className=\"ai-pitch-widget__textarea\"\n          aria-label=\"Describe your biggest marketing challenge\"\n        />\n        <div className=\"ai-pitch-widget__footer\">\n          <span className=\"ai-pitch-widget__count\">\n            {challenge.length}/{MAX_CHALLENGE_LENGTH}\n          </span>\n          <button\n            type=\"submit\"\n            disabled={status === 'sending' || !challenge.trim()}\n            className=\"ai-pitch-widget__submit\"\n          >\n            {status === 'sending' ? 'Thinking…' : 'Get my pitch'}\n          </button>\n        </div>\n      </form>\n\n      {error && (\n        <p className=\"ai-pitch-widget__error\" role=\"alert\">\n          {error}\n        </p>\n      )}\n\n      {pitch && (\n        <div className=\"ai-pitch-widget__response\">\n          <p>{pitch}</p>\n        </div>\n      )}\n\n      <style>{`\n        .ai-pitch-widget {\n          max-width: 40rem;\n          margin: 3rem auto 0;\n          padding: 1.5rem;\n          border: 1px solid var(--color-border, #e5e7eb);\n          border-radius: var(--border-radius, 8px);\n          background: var(--color-surface, #f9fafb);\n          font-family: var(--font-body, system-ui, sans-serif);\n        }\n        .ai-pitch-widget__title {\n          margin: 0;\n          font-size: 1.125rem;\n          font-weight: 600;\n          color: var(--color-heading, #111827);\n          font-family: var(--font-heading, inherit);\n        }\n        .ai-pitch-widget__subtitle {\n          margin: 0.25rem 0 1rem;\n          font-size: 0.875rem;\n          color: var(--color-muted, #6b7280);\n        }\n        .ai-pitch-widget__textarea {\n          width: 100%;\n          box-sizing: border-box;\n          padding: 0.75rem;\n          border: 1px solid var(--color-border, #d1d5db);\n          border-radius: 6px;\n          font: inherit;\n          resize: vertical;\n        }\n        .ai-pitch-widget__footer {\n          display: flex;\n          justify-content: space-between;\n          align-items: center;\n          margin-top: 0.5rem;\n        }\n        .ai-pitch-widget__count {\n          font-size: 0.75rem;\n          color: var(--color-muted, #9ca3af);\n        }\n        .ai-pitch-widget__submit {\n          padding: 0.6rem 1.25rem;\n          border: none;\n          border-radius: var(--border-radius, 6px);\n          background: var(--color-primary, #4f46e5);\n          color: var(--color-primary-text, #fff);\n          font-size: 0.875rem;\n          font-weight: 600;\n          cursor: pointer;\n        }\n        .ai-pitch-widget__submit:disabled {\n          opacity: 0.5;\n          cursor: not-allowed;\n        }\n        .ai-pitch-widget__error {\n          margin-top: 0.75rem;\n          font-size: 0.875rem;\n          color: #dc2626;\n        }\n        .ai-pitch-widget__response {\n          margin-top: 1rem;\n          padding: 1rem;\n          border-radius: 6px;\n          background: #fff;\n          border: 1px solid var(--color-border, #e5e7eb);\n          font-size: 0.9375rem;\n          line-height: 1.5;\n          color: var(--color-body, #374151);\n        }\n      `}</style>\n    </div>\n  )\n}\n"

// Embedded verbatim from astro/src/components/market/LeadForm.tsx.
const LEAD_FORM_SRC = "import { useEffect, useRef, useState, type SyntheticEvent } from 'react'\nimport { AI_PITCH_EVENT, pitchStorageKey, type PitchDetail } from './AIPitchWidget'\n\n// ── Phase 2 (Priority 1) — visitor-facing lead capture ────────────────────────\n//\n// Lives under components/market/ deliberately separate from the top-level\n// LeadForm.tsx, which belongs to the retired multi-tenant builder surface\n// (see ARCHITECTURE.md \"What Is Retired\") and needs a websiteId this page\n// doesn't have. This component calls the new public\n// POST /api/leads/:market (worker/src/routes/publicLeads.ts) instead — no\n// auth.\n//\n// The brief for this form calls Message optional in the UI while the\n// backend endpoint requires it — reconciled by submitting a placeholder\n// (\"(no message provided)\") when the visitor leaves it blank, rather than\n// forcing the field or relaxing the backend's validation.\n\ninterface MarketLeadFormProps {\n  market: string\n  apiUrl: string\n}\n\nconst NO_MESSAGE_PLACEHOLDER = '(no message provided)'\n\nfunction formatPitchContext({ challenge, pitch }: PitchDetail): string {\n  return `Their challenge: ${challenge}\\n\\nAI-suggested pitch: ${pitch}`\n}\n\ntype Status = 'idle' | 'sending' | 'sent' | 'error'\n\nexport default function LeadForm({ market, apiUrl }: MarketLeadFormProps) {\n  const [name, setName] = useState('')\n  const [email, setEmail] = useState('')\n  const [company, setCompany] = useState('')\n  const [message, setMessage] = useState('')\n  const [status, setStatus] = useState<Status>('idle')\n  const [error, setError] = useState<string | null>(null)\n\n  // True once the visitor has typed into Message themselves — guards\n  // against an AI pitch response silently overwriting something they\n  // already wrote. A ref, not state: read from an event listener\n  // registered once on mount, so it needs to see the latest value without\n  // re-subscribing on every keystroke.\n  const messageEditedByVisitor = useRef(false)\n\n  useEffect(() => {\n    function applyPitch(detail: PitchDetail) {\n      if (messageEditedByVisitor.current) return\n      setMessage(formatPitchContext(detail))\n    }\n\n    // AIPitchWidget may already have produced a result before this form\n    // mounted — pick that up from sessionStorage on mount...\n    try {\n      const stored = sessionStorage.getItem(pitchStorageKey(market))\n      if (stored) applyPitch(JSON.parse(stored) as PitchDetail)\n    } catch {\n      // Storage unavailable or content unparseable — no pre-fill, form\n      // still works standalone.\n    }\n\n    // ...and keep listening in case the widget is used after this form\n    // has already mounted.\n    function onPitchEvent(e: Event) {\n      const detail = (e as CustomEvent<PitchDetail>).detail\n      if (detail) applyPitch(detail)\n    }\n    window.addEventListener(AI_PITCH_EVENT, onPitchEvent)\n    return () => window.removeEventListener(AI_PITCH_EVENT, onPitchEvent)\n  }, [market])\n\n  async function handleSubmit(e: SyntheticEvent) {\n    e.preventDefault()\n    if (!name.trim() || !email.trim()) {\n      setError('Name and email are required.')\n      return\n    }\n\n    setStatus('sending')\n    setError(null)\n\n    try {\n      const res = await fetch(`${apiUrl}/api/leads/${encodeURIComponent(market)}`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({\n          name: name.trim(),\n          email: email.trim(),\n          company: company.trim() || undefined,\n          message: message.trim() || NO_MESSAGE_PLACEHOLDER,\n        }),\n      })\n      const json = (await res.json()) as { success?: boolean; error?: string }\n      if (!res.ok || !json.success) {\n        throw new Error(json.error ?? 'Could not send. Please try again.')\n      }\n      setStatus('sent')\n    } catch (err) {\n      setStatus('error')\n      setError(err instanceof Error ? err.message : 'Could not send. Please try again.')\n    }\n  }\n\n  if (status === 'sent') {\n    return (\n      <div className=\"market-lead-form market-lead-form--success\">\n        Thank you, we will be in touch shortly.\n      </div>\n    )\n  }\n\n  return (\n    <form onSubmit={handleSubmit} className=\"market-lead-form\">\n      <h2 className=\"market-lead-form__title\">Get in touch</h2>\n\n      <div className=\"market-lead-form__row\">\n        <label className=\"market-lead-form__field\">\n          <span>Name</span>\n          <input value={name} onChange={(e) => setName(e.target.value)} required />\n        </label>\n        <label className=\"market-lead-form__field\">\n          <span>Email</span>\n          <input type=\"email\" value={email} onChange={(e) => setEmail(e.target.value)} required />\n        </label>\n      </div>\n\n      <label className=\"market-lead-form__field\">\n        <span>\n          Company <em className=\"market-lead-form__optional\">(optional)</em>\n        </span>\n        <input value={company} onChange={(e) => setCompany(e.target.value)} />\n      </label>\n\n      <label className=\"market-lead-form__field\">\n        <span>\n          Message <em className=\"market-lead-form__optional\">(optional)</em>\n        </span>\n        <textarea\n          rows={4}\n          value={message}\n          onChange={(e) => {\n            messageEditedByVisitor.current = true\n            setMessage(e.target.value)\n          }}\n        />\n      </label>\n\n      {error && (\n        <p className=\"market-lead-form__error\" role=\"alert\">\n          {error}\n        </p>\n      )}\n\n      <button type=\"submit\" disabled={status === 'sending'} className=\"market-lead-form__submit\">\n        {status === 'sending' ? 'Sending…' : 'Send message'}\n      </button>\n\n      <style>{`\n        .market-lead-form {\n          max-width: 40rem;\n          margin: 2rem auto 0;\n          padding: 1.5rem;\n          border: 1px solid var(--color-border, #e5e7eb);\n          border-radius: var(--border-radius, 8px);\n          background: var(--color-surface, #f9fafb);\n          font-family: var(--font-body, system-ui, sans-serif);\n        }\n        .market-lead-form--success {\n          text-align: center;\n          color: var(--color-heading, #111827);\n          font-weight: 500;\n        }\n        .market-lead-form__title {\n          margin: 0 0 1rem;\n          font-size: 1.125rem;\n          font-weight: 600;\n          color: var(--color-heading, #111827);\n          font-family: var(--font-heading, inherit);\n        }\n        .market-lead-form__row {\n          display: grid;\n          grid-template-columns: 1fr 1fr;\n          gap: 1rem;\n        }\n        .market-lead-form__field {\n          display: block;\n          margin-top: 1rem;\n          font-size: 0.8125rem;\n          font-weight: 500;\n          color: var(--color-body, #374151);\n        }\n        .market-lead-form__row .market-lead-form__field {\n          margin-top: 0;\n        }\n        .market-lead-form__optional {\n          font-style: normal;\n          font-weight: 400;\n          color: var(--color-muted, #9ca3af);\n        }\n        .market-lead-form__field input,\n        .market-lead-form__field textarea {\n          display: block;\n          width: 100%;\n          box-sizing: border-box;\n          margin-top: 0.35rem;\n          padding: 0.6rem 0.75rem;\n          border: 1px solid var(--color-border, #d1d5db);\n          border-radius: 6px;\n          font: inherit;\n        }\n        .market-lead-form__error {\n          margin: 1rem 0 0;\n          font-size: 0.875rem;\n          color: #dc2626;\n        }\n        .market-lead-form__submit {\n          margin-top: 1.25rem;\n          padding: 0.6rem 1.25rem;\n          border: none;\n          border-radius: var(--border-radius, 6px);\n          background: var(--color-primary, #4f46e5);\n          color: var(--color-primary-text, #fff);\n          font-size: 0.875rem;\n          font-weight: 600;\n          cursor: pointer;\n        }\n        .market-lead-form__submit:disabled {\n          opacity: 0.5;\n          cursor: not-allowed;\n        }\n        @media (max-width: 480px) {\n          .market-lead-form__row {\n            grid-template-columns: 1fr;\n          }\n        }\n      `}</style>\n    </form>\n  )\n}\n"

export function buildAIPitchWidget(): string {
  return AI_PITCH_WIDGET_SRC
}

export function buildLeadForm(): string {
  return LEAD_FORM_SRC
}

import { useEffect, useState } from 'react'
import { adminFetch } from '../../lib/adminAuth'

export interface CopyTemplate {
  id: string
  industry: string
  headline: string
  subheadline: string
  body: string
  ctaText: string
}

export function useCopyTemplates() {
  const [templates, setTemplates] = useState<CopyTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await adminFetch('/api/admin/copy-templates')
        if (!res.ok) throw new Error(`Failed to load templates (${res.status})`)
        const json = (await res.json()) as { templates: CopyTemplate[] }
        if (!cancelled) setTemplates(json.templates)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load templates')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { templates, loading, error }
}

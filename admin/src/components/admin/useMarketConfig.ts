import { useCallback, useEffect, useRef, useState } from 'react'
import { adminFetch } from '../../lib/adminAuth'

export interface MarketConfig {
  market: string
  headline: string
  subheadline: string
  body: string
  ctaText: string
  ctaUrl: string
  aiEnabled: boolean
  emailNotifications: boolean
  // Phase 6 — set via MediaLibrary's "Set as hero" action, which reuses
  // this same hook/save path rather than a bespoke fetch.
  heroImageUrl?: string
  // Phase 8 — set via PresetsPanel's "Save preset" action, same reuse.
  stylePreset?: string
  updatedAt: string
  updatedBy: string
  // Set only by a rollback (see VersionHistoryPanel) — mirrors
  // worker/src/routes/admin.ts's MarketConfig.
  restoredFrom?: string
}

export type MarketConfigField =
  | 'headline'
  | 'subheadline'
  | 'body'
  | 'ctaText'
  | 'ctaUrl'
  | 'aiEnabled'
  | 'emailNotifications'
  | 'heroImageUrl'
  | 'stylePreset'

const EDITABLE_FIELDS: MarketConfigField[] = [
  'headline',
  'subheadline',
  'body',
  'ctaText',
  'ctaUrl',
  'aiEnabled',
  'emailNotifications',
  'heroImageUrl',
  'stylePreset',
]

type EditablePatch = Pick<MarketConfig, MarketConfigField>

function pickEditable(config: MarketConfig): EditablePatch {
  const out = {} as EditablePatch
  for (const field of EDITABLE_FIELDS) {
    ;(out as Record<MarketConfigField, unknown>)[field] = config[field]
  }
  return out
}

function editableEqual(a: MarketConfig | null, b: MarketConfig | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return JSON.stringify(pickEditable(a)) === JSON.stringify(pickEditable(b))
}

export function useMarketConfig(market: string) {
  const [saved, setSaved] = useState<MarketConfig | null>(null)
  const [draft, setDraft] = useState<MarketConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Guards against a slow, stale request overwriting state after `market`
  // has already changed again.
  const requestId = useRef(0)

  const fetchConfig = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const res = await adminFetch(`/api/admin/config/${encodeURIComponent(market)}`)
      if (res.status === 404) {
        if (id === requestId.current) {
          setSaved(null)
          setDraft(null)
          setError('Market not found')
        }
        return
      }
      if (!res.ok) throw new Error(`Failed to load config (${res.status})`)

      const config = (await res.json()) as MarketConfig
      if (id === requestId.current) {
        setSaved(config)
        setDraft(config)
      }
    } catch (e) {
      if (id === requestId.current) {
        setError(e instanceof Error ? e.message : 'Failed to load config')
      }
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [market])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const setField = useCallback(<K extends MarketConfigField>(key: K, value: MarketConfig[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev))
  }, [])

  const reset = useCallback(() => {
    setDraft(saved)
  }, [saved])

  // For VersionHistoryPanel's restore flow: the rollback already happened
  // server-side (POST /config/:market/rollback), so this just adopts the
  // result as both `saved` and `draft` — the form comes back clean, not
  // dirty, since there's nothing left to save.
  const applyRestoredConfig = useCallback((config: MarketConfig) => {
    setSaved(config)
    setDraft(config)
    setError(null)
  }, [])

  const saveConfig = useCallback(
    async (partial?: Partial<EditablePatch>): Promise<MarketConfig | undefined> => {
      if (!draft) return undefined
      const payload = { ...pickEditable(draft), ...(partial ?? {}) }

      setSaving(true)
      setError(null)
      try {
        const res = await adminFetch(`/api/admin/config/${encodeURIComponent(market)}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(body?.error ?? `Save failed (${res.status})`)
        }
        const json = (await res.json()) as { success: true; config: MarketConfig }
        setSaved(json.config)
        setDraft(json.config)
        return json.config
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed')
        throw e
      } finally {
        setSaving(false)
      }
    },
    [draft, market]
  )

  return {
    config: draft,
    loading,
    saving,
    error,
    isDirty: !editableEqual(draft, saved),
    fetchConfig,
    setField,
    saveConfig,
    reset,
    applyRestoredConfig,
  }
}

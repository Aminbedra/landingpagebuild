import { useEffect, useState, type ReactNode } from 'react'
import { useMarketConfig } from './useMarketConfig'
import AIToggle from './AIToggle'
import SaveBar from './SaveBar'
import VersionHistoryPanel from './VersionHistoryPanel'
import type { CopyTemplate } from './useCopyTemplates'

interface CopyEditorProps {
  market: string
  onDirtyChange?: (dirty: boolean) => void
  // Phase 8 — set by PresetsPanel's "Use this template" action (via
  // AdminApp) when it navigates here. Applied once the market's config
  // has loaded, then cleared via onTemplateConsumed — this only ever
  // touches local draft state (setField, not saveConfig), so the form
  // comes up dirty and nothing is written until the user hits Save
  // themselves, same as any other edit.
  pendingTemplate?: CopyTemplate | null
  onTemplateConsumed?: () => void
}

const LIMITS = { headline: 80, subheadline: 120, ctaText: 40 }
const BODY_WARN_LENGTH = 500

const inputClass =
  'w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 outline-none focus:border-indigo-500'

export default function CopyEditor({ market, onDirtyChange, pendingTemplate, onTemplateConsumed }: CopyEditorProps) {
  const { config, loading, saving, error, isDirty, fetchConfig, setField, saveConfig, reset, applyRestoredConfig } =
    useMarketConfig(market)
  const [historyOpen, setHistoryOpen] = useState(false)

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => {
    if (loading || !config || !pendingTemplate) return
    setField('headline', pendingTemplate.headline)
    setField('subheadline', pendingTemplate.subheadline)
    setField('body', pendingTemplate.body)
    setField('ctaText', pendingTemplate.ctaText)
    onTemplateConsumed?.()
    // Deliberately not depending on `config`/`setField` — this should
    // fire exactly once per pendingTemplate, not re-fire on every draft
    // change it itself causes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, pendingTemplate])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Loading {market.toUpperCase()}…
      </div>
    )
  }

  if (error && !config) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm">
        <p className="text-red-400">{error}</p>
        <button
          type="button"
          onClick={fetchConfig}
          className="rounded bg-indigo-600 px-3 py-1.5 text-white transition-colors hover:bg-indigo-500"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!config) return null

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-100">{market.toUpperCase()} — Copy</h1>
          <div className="flex items-center gap-4">
            {isDirty && (
              <button type="button" onClick={reset} className="text-sm text-gray-400 underline hover:text-gray-200">
                Discard changes
              </button>
            )}
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="flex items-center gap-1.5 rounded border border-gray-700 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-gray-800"
            >
              <ClockIcon />
              History
            </button>
          </div>
        </div>

        <div className="max-w-2xl space-y-5">
          <Field label="Headline" count={config.headline.length} max={LIMITS.headline}>
            <input
              type="text"
              value={config.headline}
              maxLength={LIMITS.headline}
              onChange={(e) => setField('headline', e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Subheadline" count={config.subheadline.length} max={LIMITS.subheadline}>
            <input
              type="text"
              value={config.subheadline}
              maxLength={LIMITS.subheadline}
              onChange={(e) => setField('subheadline', e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field
            label="Body copy"
            count={config.body.length}
            warn={config.body.length > BODY_WARN_LENGTH}
            warnMessage={`Over ${BODY_WARN_LENGTH} characters — consider trimming for readability`}
          >
            <textarea
              rows={6}
              value={config.body}
              onChange={(e) => setField('body', e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="CTA Text" count={config.ctaText.length} max={LIMITS.ctaText}>
            <input
              type="text"
              value={config.ctaText}
              maxLength={LIMITS.ctaText}
              onChange={(e) => setField('ctaText', e.target.value)}
              className={inputClass}
            />
          </Field>

          <label className="block text-sm">
            <span className="mb-1 block text-gray-400">CTA URL</span>
            <input
              type="url"
              value={config.ctaUrl}
              onChange={(e) => setField('ctaUrl', e.target.value)}
              className={inputClass}
            />
          </label>

          <AIToggle market={market} enabled={config.aiEnabled} onChange={(value) => setField('aiEnabled', value)} />
        </div>
      </div>

      <SaveBar isDirty={isDirty} saving={saving} error={error} onSave={() => saveConfig()} />

      <VersionHistoryPanel
        market={market}
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRestoreSuccess={applyRestoredConfig}
      />
    </div>
  )
}

function ClockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  )
}

function Field({
  label,
  count,
  max,
  warn,
  warnMessage,
  children,
}: {
  label: string
  count: number
  max?: number
  warn?: boolean
  warnMessage?: string
  children: ReactNode
}) {
  const overLimit = max !== undefined && count >= max
  return (
    <label className="block text-sm">
      <span className="mb-1 flex items-center justify-between text-gray-400">
        <span>{label}</span>
        <span className={overLimit || warn ? 'text-amber-400' : 'text-gray-500'}>
          {count}
          {max !== undefined ? `/${max}` : ''}
        </span>
      </span>
      {children}
      {warn && warnMessage && <span className="mt-1 block text-xs text-amber-400">{warnMessage}</span>}
    </label>
  )
}

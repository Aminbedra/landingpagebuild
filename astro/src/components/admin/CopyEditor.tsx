import { useEffect, type ReactNode } from 'react'
import { useMarketConfig } from './useMarketConfig'
import AIToggle from './AIToggle'
import SaveBar from './SaveBar'

interface CopyEditorProps {
  market: string
  onDirtyChange?: (dirty: boolean) => void
}

const LIMITS = { headline: 80, subheadline: 120, ctaText: 40 }
const BODY_WARN_LENGTH = 500

const inputClass =
  'w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 outline-none focus:border-indigo-500'

export default function CopyEditor({ market, onDirtyChange }: CopyEditorProps) {
  const { config, loading, saving, error, isDirty, fetchConfig, setField, saveConfig, reset } =
    useMarketConfig(market)

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

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
          {isDirty && (
            <button type="button" onClick={reset} className="text-sm text-gray-400 underline hover:text-gray-200">
              Discard changes
            </button>
          )}
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
    </div>
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

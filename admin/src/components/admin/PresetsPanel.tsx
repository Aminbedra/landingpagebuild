import { useEffect, useState } from 'react'
import { STYLE_PRESETS, type StylePreset } from '../../lib/presets'
import { useMarketConfig } from './useMarketConfig'
import { useCopyTemplates, type CopyTemplate } from './useCopyTemplates'
import { adminFetch } from '../../lib/adminAuth'

interface PresetsPanelProps {
  // Phase 8's "Use this template" needs to hand the template off to
  // CopyEditor across a tab switch — that's AdminApp's job (it already
  // owns navigation), not this component's. See AdminApp's pendingTemplate
  // wiring.
  onUseTemplate: (market: string, template: CopyTemplate) => void
}

// Account-scoped like Users/Media/Analytics — the market picker below is
// local UI state for this view, not the ?market=/?view= URL routing used
// by CopyEditor/LeadsDashboard.
export default function PresetsPanel({ onUseTemplate }: PresetsPanelProps) {
  const [markets, setMarkets] = useState<string[]>([])
  const [marketsLoading, setMarketsLoading] = useState(true)
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await adminFetch('/api/admin/markets')
        if (!res.ok) return
        const json = (await res.json()) as { markets: string[] }
        if (!cancelled) {
          setMarkets(json.markets)
          setSelectedMarket((current) => current ?? json.markets[0] ?? null)
        }
      } finally {
        if (!cancelled) setMarketsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 2500)
  }

  // Reused for reading/writing stylePreset the same way MediaLibrary
  // reuses it for heroImageUrl — one save path for every config field,
  // not a bespoke fetch per feature.
  const { config, isDirty, saving, setField, saveConfig } = useMarketConfig(selectedMarket ?? '')
  const activePresetId = config?.stylePreset ?? 'classic'
  const [presetError, setPresetError] = useState<string | null>(null)

  const { templates, loading: templatesLoading, error: templatesError } = useCopyTemplates()

  async function handleSavePreset() {
    if (!selectedMarket) return
    setPresetError(null)
    try {
      await saveConfig()
      showToast(`Preset updated for ${selectedMarket.toUpperCase()} market`)
    } catch (e) {
      setPresetError(e instanceof Error ? e.message : 'Failed to save preset')
    }
  }

  function handleUseTemplate(template: CopyTemplate) {
    if (!selectedMarket) return
    onUseTemplate(selectedMarket, template)
    showToast('Template loaded — review and save in the Copy tab')
  }

  if (marketsLoading) {
    return <div className="flex h-full items-center justify-center text-sm text-gray-400">Loading…</div>
  }
  if (markets.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-gray-400">No markets configured yet.</div>
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-lg font-semibold text-gray-100">Presets</h1>

          <label className="text-sm">
            <span className="mb-1 block text-gray-400">Market</span>
            <select
              value={selectedMarket ?? ''}
              onChange={(e) => setSelectedMarket(e.target.value)}
              className="rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 outline-none focus:border-indigo-500"
            >
              {markets.map((m) => (
                <option key={m} value={m}>
                  {m.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide text-gray-400 uppercase">Style presets</h2>
              <button
                type="button"
                disabled={!isDirty || saving}
                onClick={handleSavePreset}
                className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save preset'}
              </button>
            </div>

            {presetError && <p className="mb-3 text-sm text-red-400">{presetError}</p>}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {STYLE_PRESETS.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  active={activePresetId === preset.id}
                  onSelect={() => setField('stylePreset', preset.id)}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-400 uppercase">Copy templates</h2>

            {templatesError && <p className="mb-3 text-sm text-red-400">{templatesError}</p>}

            {templatesLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-800" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-700 bg-gray-900 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">{template.industry}</p>
                      <p className="truncate text-sm text-gray-100">{template.headline}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUseTemplate(template)}
                      className="shrink-0 rounded border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-800"
                    >
                      Use this template
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {toast && (
        <div className="fixed right-6 bottom-6 z-40 rounded-lg bg-gray-800 px-4 py-2.5 text-sm text-gray-100 shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  )
}

function PresetCard({ preset, active, onSelect }: { preset: StylePreset; active: boolean; onSelect: () => void }) {
  const swatches: [string, string][] = [
    ['background', preset.colors.background],
    ['surface', preset.colors.surface],
    ['primary', preset.colors.primary],
    ['heading', preset.colors.heading],
    ['body', preset.colors.body],
  ]

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-xl border p-4 text-left transition-colors ${
        active ? 'border-indigo-500 bg-indigo-600/10' : 'border-gray-700 bg-gray-900 hover:border-gray-600'
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-100">{preset.name}</p>
        {active && <span className="rounded-full bg-indigo-600/20 px-2 py-0.5 text-xs text-indigo-400">Active</span>}
      </div>
      <p className="mt-1 text-xs text-gray-500">{preset.description}</p>

      <div className="mt-3 flex gap-1.5">
        {swatches.map(([label, color]) => (
          <span
            key={label}
            title={label}
            className="h-5 w-5 rounded-full border border-gray-700"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      <p className="mt-3 text-xs text-gray-500">
        {preset.fonts.heading === preset.fonts.body
          ? preset.fonts.heading
          : `${preset.fonts.heading} / ${preset.fonts.body}`}
      </p>
    </button>
  )
}

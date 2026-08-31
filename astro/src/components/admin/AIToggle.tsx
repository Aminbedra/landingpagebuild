interface AIToggleProps {
  market: string
  enabled: boolean
  onChange: (value: boolean) => void
}

// Optimistic toggle only — flips local form state via onChange. The actual
// PUT happens from SaveBar, same as every other field on the form.
export default function AIToggle({ market, enabled, onChange }: AIToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-700 bg-gray-800 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-gray-100">AI Pitch Widget</p>
        <p className="text-sm text-gray-400">Show the AI chat widget on this market's landing page</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`AI Pitch Widget for ${market.toUpperCase()}`}
        onClick={() => onChange(!enabled)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          enabled ? 'bg-emerald-500' : 'bg-gray-600'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

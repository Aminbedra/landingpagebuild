import { useCallback, useEffect, useState } from 'react'

interface SaveBarProps {
  isDirty: boolean
  saving: boolean
  error: string | null
  onSave: () => Promise<unknown>
}

// Sticky save control shared by every CopyEditor. Cmd/Ctrl+S triggers the
// same save path as the button.
export default function SaveBar({ isDirty, saving, error, onSave }: SaveBarProps) {
  const [justSaved, setJustSaved] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSave = useCallback(async () => {
    if (!isDirty || saving) return
    setLocalError(null)
    try {
      await onSave()
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Save failed')
    }
  }, [isDirty, saving, onSave])

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [handleSave])

  const displayError = localError ?? error

  return (
    <div className="flex shrink-0 items-center justify-between gap-4 border-t border-gray-700 bg-gray-900 px-6 py-3">
      <div key={displayError ?? (justSaved ? 'saved' : isDirty ? 'dirty' : 'clean')} className="fade-in text-sm">
        {displayError ? (
          <span className="flex items-center gap-2 text-red-400">
            {displayError}
            <button type="button" onClick={handleSave} className="underline hover:text-red-300">
              Retry
            </button>
          </span>
        ) : justSaved ? (
          <span className="text-emerald-500">Saved ✓</span>
        ) : isDirty ? (
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Unsaved changes
          </span>
        ) : (
          <span className="text-gray-400">All changes saved</span>
        )}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!isDirty || saving}
        className="shrink-0 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save Changes'}
      </button>
    </div>
  )
}

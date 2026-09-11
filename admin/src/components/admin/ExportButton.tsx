import { useState } from 'react'
import { adminFetch } from '../../lib/adminAuth'

// ── Priority 2, Part B — one-click site export ────────────────────────────────
//
// Calls GET /api/export/:market (worker/src/routes/export.ts) and triggers
// a browser download of the returned zip. Same blob + createObjectURL
// pattern as useLeads.ts's exportCsv — adminFetch already attaches the
// Bearer token, so a plain <a href> (no auth header) can't be used here.

interface ExportButtonProps {
  market: string
}

type Status = 'idle' | 'exporting' | 'error'

export default function ExportButton({ market }: ExportButtonProps) {
  const [status, setStatus] = useState<Status>('idle')

  async function handleExport() {
    setStatus('exporting')
    try {
      const res = await adminFetch(`/api/export/${encodeURIComponent(market)}`)
      if (!res.ok) throw new Error(`Export failed (${res.status})`)

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const filenameMatch = /filename="?([^"]+)"?/.exec(disposition)
      const filename = filenameMatch?.[1] ?? `landingpagebuild-${market}.zip`

      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={handleExport}
        disabled={status === 'exporting'}
        title="Download your site as a standalone Astro project. Deploy to Vercel or Cloudflare Pages with your own account."
        className="flex items-center gap-1.5 rounded border border-gray-700 px-3 py-1.5 text-sm text-gray-300 transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ExportIcon />
        {status === 'exporting' ? 'Exporting…' : 'Export site as Astro project'}
      </button>
      {status === 'error' && (
        <span className="absolute top-full left-0 mt-1 whitespace-nowrap text-xs text-red-400" role="alert">
          Export failed. Please try again.
        </span>
      )}
    </span>
  )
}

function ExportIcon() {
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
      <path d="M12 15V3" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 17v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  )
}

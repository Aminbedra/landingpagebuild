import { useEffect, useState } from 'react'
import { useLeads, type Lead } from './useLeads'

interface LeadsDashboardProps {
  market: string
  // Beyond the brief's literal { market } props: MarketSidebar's "Leads
  // (12)" badge needs to know each market's total, but that count only
  // exists inside this component's useLeads() call. Lifting it up this way
  // mirrors how CopyEditor already reports isDirty up via onDirtyChange.
  onTotalLoaded?: (market: string, total: number) => void
}

const inputClass =
  'w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 outline-none focus:border-indigo-500'

export default function LeadsDashboard({ market, onTotalLoaded }: LeadsDashboardProps) {
  const { leads, cursor, total, loading, loadingMore, error, fetchLeads, loadMore, exportCsv, exporting, exportError } =
    useLeads(market)

  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !error) onTotalLoaded?.(market, total)
  }, [loading, error, total, market, onTotalLoaded])

  const filtersActive = Boolean(search.trim() || dateFrom || dateTo)

  const filteredLeads = leads.filter((lead) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      if (!lead.name.toLowerCase().includes(q) && !lead.email.toLowerCase().includes(q)) return false
    }
    if (dateFrom && new Date(lead.submittedAt) < new Date(`${dateFrom}T00:00:00`)) return false
    if (dateTo && new Date(lead.submittedAt) > new Date(`${dateTo}T23:59:59.999`)) return false
    return true
  })

  function clearFilters() {
    setSearch('')
    setDateFrom('')
    setDateTo('')
  }

  if (error && leads.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm">
        <p className="text-red-400">{error}</p>
        <button
          type="button"
          onClick={fetchLeads}
          className="rounded bg-indigo-600 px-3 py-1.5 text-white transition-colors hover:bg-indigo-500"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-100">Leads — {market.toUpperCase()}</h1>
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded bg-gray-700 px-3 py-1.5 text-sm text-gray-100 transition-colors hover:bg-gray-600 disabled:opacity-60"
          >
            <DownloadIcon />
            {exporting ? 'Downloading…' : 'Export CSV'}
          </button>
        </div>

        {exportError && (
          <p className="mb-4 rounded border border-red-600/40 bg-red-600/10 px-3 py-2 text-sm text-red-400">
            {exportError}
          </p>
        )}

        <div className="mb-4 flex items-center gap-4 text-sm text-gray-400">
          <span>
            {total} total lead{total === 1 ? '' : 's'}
          </span>
          {!loading && cursor && (
            <span>
              Showing {leads.length} of {total}
            </span>
          )}
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1 text-sm">
            <span className="mb-1 block text-gray-400">Search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email"
              className={inputClass}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-400">From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-gray-400">To</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
          </label>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm text-gray-400 underline hover:text-gray-200"
            >
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <SkeletonTable />
        ) : filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-16 text-center text-sm text-gray-500">
            {filtersActive ? (
              <p>No leads match your filters. Try clearing the search or date range.</p>
            ) : (
              <p>
                No leads yet for {market.toUpperCase()}. Leads will appear here once visitors submit the form on the
                landing page.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-gray-700 bg-gray-900">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-800 text-xs tracking-wide text-gray-400 uppercase">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Email</th>
                    <th className="px-4 py-2.5 font-medium">Message</th>
                    <th className="px-4 py-2.5 font-medium">Submitted</th>
                    <th className="px-4 py-2.5 font-medium">AI</th>
                    <th className="px-4 py-2.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => (
                    <LeadRow
                      key={lead.id}
                      lead={lead}
                      expanded={expandedId === lead.id}
                      onToggle={() => setExpandedId((cur) => (cur === lead.id ? null : lead.id))}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {error && leads.length > 0 && <p className="mt-3 text-center text-sm text-red-400">{error}</p>}

            {cursor && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="text-sm text-indigo-400 hover:text-indigo-300 disabled:opacity-60"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function LeadRow({ lead, expanded, onToggle }: { lead: Lead; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="border-t border-gray-800 hover:bg-gray-800/50">
        <td className="px-4 py-3 whitespace-nowrap text-gray-100">{lead.name}</td>
        <td className="px-4 py-3 whitespace-nowrap">
          <a href={`mailto:${lead.email}`} className="text-indigo-400 hover:text-indigo-300">
            {lead.email}
          </a>
        </td>
        <td className="px-4 py-3 text-gray-300">{truncate(lead.message, 80)}</td>
        <td className="px-4 py-3 whitespace-nowrap text-gray-400">{formatSubmitted(lead.submittedAt)}</td>
        <td className="px-4 py-3">
          {lead.aiSummary && (
            <span className="rounded-full bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-400">✓ AI</span>
          )}
        </td>
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? 'Collapse' : 'View'}
            title={expanded ? 'Collapse' : 'View'}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
          >
            <ExpandIcon expanded={expanded} />
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-gray-700 bg-gray-950">
          <td colSpan={6} className="px-4 py-4">
            <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Full message</p>
            <p className="mt-1 text-sm whitespace-pre-wrap text-gray-200">{lead.message}</p>
            {lead.aiSummary && (
              <>
                <p className="mt-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  AI conversation summary
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap text-gray-300">{lead.aiSummary}</p>
              </>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

function SkeletonTable() {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-900">
      <div className="divide-y divide-gray-800">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <div className="h-3 w-24 animate-pulse rounded bg-gray-800" />
            <div className="h-3 w-32 animate-pulse rounded bg-gray-800" />
            <div className="h-3 flex-1 animate-pulse rounded bg-gray-800" />
            <div className="h-3 w-28 animate-pulse rounded bg-gray-800" />
          </div>
        ))}
      </div>
    </div>
  )
}

function DownloadIcon() {
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
      <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" />
    </svg>
  )
}

function ExpandIcon({ expanded }: { expanded: boolean }) {
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
      className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function formatSubmitted(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

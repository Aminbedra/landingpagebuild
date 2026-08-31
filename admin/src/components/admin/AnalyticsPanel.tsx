import { useEffect, useState } from 'react'
import { useAnalytics, type AnalyticsDay } from './useAnalytics'
import { adminFetch } from '../../lib/adminAuth'

type Period = 7 | 30 | 90

// Account-scoped like Users/Media — the market picker below is local UI
// state for this view, not the ?market=/?view= URL routing used by
// CopyEditor/LeadsDashboard.
export default function AnalyticsPanel() {
  const [markets, setMarkets] = useState<string[]>([])
  const [marketsLoading, setMarketsLoading] = useState(true)
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>(30)

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

  const { data, loading, error, fetchAnalytics } = useAnalytics(selectedMarket, period)

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
          <h1 className="text-lg font-semibold text-gray-100">Analytics</h1>

          <div className="flex items-end gap-3">
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

            <label className="text-sm">
              <span className="mb-1 block text-gray-400">Period</span>
              <select
                value={period}
                onChange={(e) => setPeriod(Number(e.target.value) as Period)}
                className="rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 outline-none focus:border-indigo-500"
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </label>
          </div>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-400">
            {error}{' '}
            <button type="button" onClick={fetchAnalytics} className="underline hover:text-red-300">
              Retry
            </button>
          </p>
        )}

        {loading || !data ? (
          <SkeletonBody />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatTile label="Total pageviews" value={data.totals.pageviews.toLocaleString()} />
              <StatTile label="Total leads" value={data.totals.leads.toLocaleString()} />
              <StatTile label="Conversion rate" value={`${data.totals.conversionRate}%`} />
            </div>

            <div className="mt-6 rounded-xl border border-gray-700 bg-gray-900 p-4">
              <div className="mb-3 flex items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: '#4f46e5' }} />
                  Pageviews
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: '#10b981' }} />
                  Leads
                </span>
              </div>
              <LineChart series={data.series} />
            </div>

            <div className="mt-6 overflow-x-auto rounded-xl border border-gray-700 bg-gray-900">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-800 text-xs tracking-wide text-gray-400 uppercase">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Pageviews</th>
                    <th className="px-4 py-2.5 font-medium">Leads</th>
                    <th className="px-4 py-2.5 font-medium">Conversion rate</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.series].reverse().map((day) => (
                    <tr key={day.date} className="border-t border-gray-800">
                      <td className="px-4 py-2.5 whitespace-nowrap text-gray-100">{day.date}</td>
                      <td className="px-4 py-2.5 text-gray-300">{day.pageviews.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-gray-300">{day.leads.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-gray-300">{day.conversionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-100">{value}</p>
    </div>
  )
}

// No charting library — hand-drawn SVG. Two independent Y scales
// (pageviews left, leads right) sharing one X axis, since the two series
// can differ by orders of magnitude.
function LineChart({ series }: { series: AnalyticsDay[] }) {
  const width = 800
  const height = 220
  const padding = { top: 12, right: 16, bottom: 22, left: 16 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom

  if (series.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">No data for this period.</p>
  }

  const maxPageviews = Math.max(1, ...series.map((d) => d.pageviews))
  const maxLeads = Math.max(1, ...series.map((d) => d.leads))

  const xStep = series.length > 1 ? innerWidth / (series.length - 1) : 0
  const xAt = (i: number) => padding.left + i * xStep
  const yAtPageviews = (v: number) => padding.top + innerHeight - (v / maxPageviews) * innerHeight
  const yAtLeads = (v: number) => padding.top + innerHeight - (v / maxLeads) * innerHeight

  const pageviewsPath = series.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAtPageviews(d.pageviews)}`).join(' ')
  const leadsPath = series.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAtLeads(d.leads)}`).join(' ')

  // Thin out x-axis date labels once there are more than ~8 points, so
  // 90 days of labels don't overlap into mush.
  const labelEvery = Math.max(1, Math.ceil(series.length / 8))

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Pageviews and leads over time">
      {[0.25, 0.5, 0.75, 1].map((f) => {
        const y = padding.top + innerHeight - f * innerHeight
        return (
          <line
            key={f}
            x1={padding.left}
            x2={width - padding.right}
            y1={y}
            y2={y}
            stroke="currentColor"
            className="text-gray-800"
            strokeWidth={1}
          />
        )
      })}

      <path d={pageviewsPath} fill="none" stroke="#4f46e5" strokeWidth={2} />
      <path d={leadsPath} fill="none" stroke="#10b981" strokeWidth={2} />

      {series.map((d, i) => (
        <g key={d.date}>
          {/* Larger invisible hit target — the visible dots (r=3) are too
              small to hover precisely. One combined tooltip covers both
              series for this date rather than two separate ones. */}
          <circle cx={xAt(i)} cy={(yAtPageviews(d.pageviews) + yAtLeads(d.leads)) / 2} r={10} fill="transparent">
            <title>{`${d.date}\nPageviews: ${d.pageviews}\nLeads: ${d.leads}\nConversion: ${d.conversionRate}%`}</title>
          </circle>
          <circle cx={xAt(i)} cy={yAtPageviews(d.pageviews)} r={3} fill="#4f46e5" pointerEvents="none" />
          <circle cx={xAt(i)} cy={yAtLeads(d.leads)} r={3} fill="#10b981" pointerEvents="none" />
        </g>
      ))}

      {series.map((d, i) =>
        i % labelEvery === 0 ? (
          <text
            key={d.date}
            x={xAt(i)}
            y={height - 4}
            fontSize={9}
            textAnchor="middle"
            fill="currentColor"
            className="text-gray-500"
          >
            {d.date.slice(5)}
          </text>
        ) : null
      )}
    </svg>
  )
}

function SkeletonBody() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-800" />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-xl bg-gray-800" />
      <div className="h-40 animate-pulse rounded-xl bg-gray-800" />
    </div>
  )
}

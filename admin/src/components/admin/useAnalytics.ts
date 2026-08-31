import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '../../lib/adminAuth'

export interface AnalyticsDay {
  date: string
  pageviews: number
  leads: number
  conversionRate: number
}

export interface AnalyticsData {
  market: string
  days: number
  series: AnalyticsDay[]
  totals: { pageviews: number; leads: number; conversionRate: number }
}

export function useAnalytics(market: string | null, days: number) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async () => {
    if (!market) return
    setLoading(true)
    setError(null)
    try {
      const res = await adminFetch(`/api/admin/analytics?market=${encodeURIComponent(market)}&days=${days}`)
      if (!res.ok) throw new Error(`Failed to load analytics (${res.status})`)
      const json = (await res.json()) as AnalyticsData
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [market, days])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  return { data, loading, error, fetchAnalytics }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { adminFetch } from '../../lib/adminAuth'

export interface Lead {
  id: string
  name: string
  email: string
  message: string
  market: string
  subdomain: string
  submittedAt: string
  aiSummary?: string
}

interface LeadsResponse {
  leads: Lead[]
  total: number
  offset: number
  limit: number
  hasMore: boolean
}

export function useLeads(market: string) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // Guards against a slow, stale request overwriting state after `market`
  // has already changed again — same pattern as useMarketConfig.
  const requestId = useRef(0)

  const fetchLeads = useCallback(async () => {
    const id = ++requestId.current
    setLeads([])
    setHasMore(false)
    setTotal(0)
    setLoading(true)
    setError(null)
    try {
      const res = await adminFetch(`/api/admin/leads/${encodeURIComponent(market)}`)
      if (!res.ok) throw new Error(`Failed to load leads (${res.status})`)
      const json = (await res.json()) as LeadsResponse
      if (id === requestId.current) {
        setLeads(json.leads)
        setHasMore(json.hasMore)
        setTotal(json.total)
      }
    } catch (e) {
      if (id === requestId.current) setError(e instanceof Error ? e.message : 'Failed to load leads')
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [market])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // D1 uses plain LIMIT/OFFSET (switched from KV's cursor pagination in
  // the Part 3.5 D1 migration) — the next page just starts at how many
  // rows are already loaded.
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return
    setLoadingMore(true)
    setError(null)
    try {
      const res = await adminFetch(
        `/api/admin/leads/${encodeURIComponent(market)}?offset=${leads.length}`
      )
      if (!res.ok) throw new Error(`Failed to load more leads (${res.status})`)
      const json = (await res.json()) as LeadsResponse
      setLeads((prev) => [...prev, ...json.leads])
      setHasMore(json.hasMore)
      setTotal(json.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more leads')
    } finally {
      setLoadingMore(false)
    }
  }, [market, leads.length, hasMore, loadingMore])

  const exportCsv = useCallback(async () => {
    setExporting(true)
    setExportError(null)
    try {
      const res = await adminFetch(`/api/admin/leads/${encodeURIComponent(market)}/export`)
      if (!res.ok) throw new Error(`Export failed (${res.status})`)

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const filenameMatch = /filename="?([^"]+)"?/.exec(disposition)
      const filename = filenameMatch?.[1] ?? `leads-${market}.csv`

      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch {
      setExportError('Export failed. Please try again.')
    } finally {
      setExporting(false)
    }
  }, [market])

  return {
    leads,
    hasMore,
    total,
    loading,
    loadingMore,
    error,
    fetchLeads,
    loadMore,
    exportCsv,
    exporting,
    exportError,
  }
}

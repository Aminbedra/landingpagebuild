import { useCallback, useEffect, useState } from 'react'
import { adminFetch, getApiUrl, getToken } from '../../lib/adminAuth'

export interface MediaAsset {
  key: string
  size: number
  uploaded: string
  originalName: string
  contentType: string
  url: string
}

export function useMedia() {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAssets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminFetch('/api/admin/media')
      if (!res.ok) throw new Error(`Failed to load media (${res.status})`)
      const json = (await res.json()) as { objects: MediaAsset[] }
      setAssets(json.objects)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load media')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  // XHR, not fetch — fetch() has no way to observe request-body (upload)
  // progress, only response-body progress. xhr.upload.onprogress is the
  // standard way to get real upload percentages.
  const uploadFile = useCallback((file: File, onProgress?: (pct: number) => void): Promise<MediaAsset> => {
    return new Promise((resolve, reject) => {
      const token = getToken()
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${getApiUrl()}/api/admin/media`)
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const asset = JSON.parse(xhr.responseText) as MediaAsset
            setAssets((prev) => [asset, ...prev])
            resolve(asset)
          } catch {
            reject(new Error('Invalid response from server'))
          }
        } else {
          let message = `Upload failed (${xhr.status})`
          try {
            const body = JSON.parse(xhr.responseText) as { error?: string }
            if (body.error) message = body.error
          } catch {
            // non-JSON error body — keep the generic message
          }
          reject(new Error(message))
        }
      }
      xhr.onerror = () => reject(new Error('Upload failed — network error'))

      const formData = new FormData()
      formData.append('file', file)
      xhr.send(formData)
    })
  }, [])

  const deleteAsset = useCallback(async (key: string) => {
    const res = await adminFetch(`/api/admin/media/${encodeURIComponent(key)}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(body?.error ?? `Delete failed (${res.status})`)
    }
    setAssets((prev) => prev.filter((a) => a.key !== key))
  }, [])

  return { assets, loading, error, fetchAssets, uploadFile, deleteAsset }
}

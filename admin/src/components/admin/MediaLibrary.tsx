import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { useMedia, type MediaAsset } from './useMedia'
import { useMarketConfig } from './useMarketConfig'
import { adminFetch } from '../../lib/adminAuth'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
const ACCEPTED_LABEL = 'JPEG, PNG, WebP, GIF, SVG'
const MAX_SIZE_BYTES = 5 * 1024 * 1024

// Account-scoped like UsersPanel, not per-market — the market picker below
// is local UI state for the "set as hero" section only, not the
// ?market=/?view= URL routing used by CopyEditor/LeadsDashboard.
export default function MediaLibrary() {
  const { assets, loading, error, fetchAssets, uploadFile, deleteAsset } = useMedia()
  const [toast, setToast] = useState<string | null>(null)

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 2500)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <h1 className="mb-6 text-lg font-semibold text-gray-100">Media Library</h1>

        <UploadZone onUploaded={() => {}} uploadFile={uploadFile} />

        <h2 className="mt-8 mb-3 text-sm font-semibold tracking-wide text-gray-400 uppercase">Assets</h2>

        {error && (
          <p className="mb-4 text-sm text-red-400">
            {error}{' '}
            <button type="button" onClick={fetchAssets} className="underline hover:text-red-300">
              Retry
            </button>
          </p>
        )}

        {loading ? (
          <SkeletonGrid />
        ) : assets.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No assets uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((asset) => (
              <AssetCard key={asset.key} asset={asset} onDeleted={deleteAsset} onCopied={() => showToast('URL copied')} />
            ))}
          </div>
        )}

        <HeroImageSection assets={assets} onSet={(market) => showToast(`Hero image updated for ${market.toUpperCase()} market`)} />
      </div>

      {toast && (
        <div className="fixed right-6 bottom-6 z-40 rounded-lg bg-gray-800 px-4 py-2.5 text-sm text-gray-100 shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  )
}

function UploadZone({
  uploadFile,
  onUploaded,
}: {
  uploadFile: (file: File, onProgress?: (pct: number) => void) => Promise<MediaAsset>
  onUploaded: (asset: MediaAsset) => void
}) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validate = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `File type not allowed. Accepted: ${ACCEPTED_LABEL}`
    }
    if (file.size > MAX_SIZE_BYTES) {
      return 'File too large. Maximum size is 5MB'
    }
    return null
  }, [])

  const handleFile = useCallback(
    async (file: File) => {
      const validationError = validate(file)
      if (validationError) {
        setError(validationError)
        return
      }

      setError(null)
      setUploading(true)
      setProgress(0)
      try {
        const asset = await uploadFile(file, setProgress)
        onUploaded(asset)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed')
      } finally {
        setUploading(false)
      }
    },
    [uploadFile, onUploaded, validate]
  )

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging ? 'border-indigo-500 bg-indigo-600/10' : 'border-gray-700 hover:border-gray-600'
        }`}
      >
        <UploadIcon />
        <p className="mt-3 text-sm text-gray-300">Drag and drop an image, or click to browse</p>
        <p className="mt-1 text-xs text-gray-500">{ACCEPTED_LABEL} · max 5MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />
      </div>

      {uploading && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
            <div className="h-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-xs text-gray-500">Uploading… {progress}%</p>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  )
}

function AssetCard({
  asset,
  onDeleted,
  onCopied,
}: {
  asset: MediaAsset
  onDeleted: (key: string) => Promise<void>
  onCopied: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await onDeleted(asset.key)
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Delete failed')
      setConfirming(false)
    } finally {
      setDeleting(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(asset.url)
      onCopied()
    } catch {
      // clipboard permission denied or unavailable — nothing sensible to
      // do beyond leaving the URL visible via the card itself
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-900">
      <div className="aspect-square bg-gray-800">
        <img src={asset.url} alt={asset.originalName} className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="p-3">
        <p className="truncate text-sm text-gray-100" title={asset.originalName}>
          {asset.originalName}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">
          {formatBytes(asset.size)} · {formatDate(asset.uploaded)}
        </p>

        {deleteError && <p className="mt-2 text-xs text-red-400">{deleteError}</p>}

        {confirming ? (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-60"
            >
              {deleting ? 'Deleting…' : 'Confirm'}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => setConfirming(false)}
              className="rounded px-2 py-1 text-xs text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="mt-2 flex gap-3">
            <button type="button" onClick={handleCopy} className="text-xs text-gray-400 underline hover:text-gray-200">
              Copy URL
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-xs text-red-400 underline hover:text-red-300"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function HeroImageSection({ assets, onSet }: { assets: MediaAsset[]; onSet: (market: string) => void }) {
  const [markets, setMarkets] = useState<string[]>([])
  const [marketsLoading, setMarketsLoading] = useState(true)
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null)

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

  // Reuses the same hook CopyEditor saves through — setting a hero image
  // is just another field on the same config, not a separate endpoint.
  const { config, setField, saveConfig } = useMarketConfig(selectedMarket ?? '')
  const [settingKey, setSettingKey] = useState<string | null>(null)
  const [setError, setSetError] = useState<string | null>(null)

  async function handleSetHero(url: string, key: string) {
    if (!selectedMarket) return
    setSettingKey(key)
    setSetError(null)
    try {
      setField('heroImageUrl', url)
      await saveConfig({ heroImageUrl: url })
      onSet(selectedMarket)
    } catch (e) {
      setSetError(e instanceof Error ? e.message : 'Failed to set hero image')
    } finally {
      setSettingKey(null)
    }
  }

  if (marketsLoading || markets.length === 0) return null

  return (
    <div className="mt-10 border-t border-gray-800 pt-6">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-400 uppercase">Hero image per market</h2>

      <label className="mb-4 block max-w-xs text-sm">
        <span className="mb-1 block text-gray-400">Market</span>
        <select
          value={selectedMarket ?? ''}
          onChange={(e) => setSelectedMarket(e.target.value)}
          className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 outline-none focus:border-indigo-500"
        >
          {markets.map((m) => (
            <option key={m} value={m}>
              {m.toUpperCase()}
            </option>
          ))}
        </select>
      </label>

      {config?.heroImageUrl ? (
        <div className="mb-4 flex items-center gap-3">
          <img src={config.heroImageUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
          <p className="text-sm text-gray-400">Current hero image for {selectedMarket?.toUpperCase()}</p>
        </div>
      ) : (
        <p className="mb-4 text-sm text-gray-500">No hero image set for {selectedMarket?.toUpperCase()}.</p>
      )}

      {setError && <p className="mb-3 text-sm text-red-400">{setError}</p>}

      {assets.length === 0 ? (
        <p className="text-sm text-gray-500">Upload an asset above to set it as a hero image.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {assets.map((asset) => {
            const isActive = config?.heroImageUrl === asset.url
            return (
              <div key={asset.key} className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900">
                <div className="aspect-square bg-gray-800">
                  <img src={asset.url} alt={asset.originalName} className="h-full w-full object-cover" loading="lazy" />
                </div>
                <button
                  type="button"
                  disabled={isActive || settingKey === asset.key}
                  onClick={() => handleSetHero(asset.url, asset.key)}
                  className={`w-full px-2 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-900/40 text-emerald-400'
                      : 'bg-gray-800 text-gray-300 hover:bg-indigo-600 hover:text-white disabled:opacity-60'
                  }`}
                >
                  {isActive ? 'Current hero' : settingKey === asset.key ? 'Setting…' : 'Set as hero'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="aspect-square animate-pulse rounded-xl bg-gray-800" />
      ))}
    </div>
  )
}

function UploadIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-gray-500"
    >
      <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" />
    </svg>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

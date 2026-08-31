import { useState, type ReactNode } from 'react'
import MarketSidebar, { type AdminView } from './MarketSidebar'

interface AdminLayoutProps {
  selectedMarket: string | null
  view: AdminView
  dirtyMarket: string | null
  leadCounts: Record<string, number>
  onNavigate: (market: string, view: AdminView) => void
  onMarketsLoaded: (markets: string[]) => void
  onCloneSuccess: (newMarket: string) => void
  userEmail: string | null
  onLogout: () => void
  children: ReactNode
}

export default function AdminLayout({
  selectedMarket,
  view,
  dirtyMarket,
  leadCounts,
  onNavigate,
  onMarketsLoaded,
  onCloneSuccess,
  userEmail,
  onLogout,
  children,
}: AdminLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  function navigateAndClose(market: string, nextView: AdminView) {
    onNavigate(market, nextView)
    setMobileNavOpen(false)
  }

  return (
    <div className="flex h-full flex-col bg-gray-950">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-700 bg-gray-900 px-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileNavOpen((v) => !v)}
            className="flex flex-col gap-1 rounded p-1.5 text-gray-300 hover:bg-gray-800 md:hidden"
            aria-label="Toggle sidebar"
          >
            <span className="block h-0.5 w-5 bg-current" />
            <span className="block h-0.5 w-5 bg-current" />
            <span className="block h-0.5 w-5 bg-current" />
          </button>
          <span className="text-sm font-semibold text-gray-100">LandingPageBuild Admin</span>
        </div>

        <div className="flex items-center gap-3 text-sm text-gray-400">
          {userEmail && <span className="hidden sm:inline">{userEmail}</span>}
          <button type="button" onClick={onLogout} className="underline hover:text-gray-200">
            Sign out
          </button>
        </div>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        {mobileNavOpen && (
          <div className="absolute inset-0 z-10 bg-black/50 md:hidden" onClick={() => setMobileNavOpen(false)} />
        )}

        <aside
          className={`absolute inset-y-0 left-0 z-20 w-64 transform border-r border-gray-700 bg-gray-900 transition-transform duration-200 md:relative md:z-auto md:w-56 md:translate-x-0 ${
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <MarketSidebar
            selectedMarket={selectedMarket}
            view={view}
            dirtyMarket={dirtyMarket}
            leadCounts={leadCounts}
            onNavigate={navigateAndClose}
            onMarketsLoaded={onMarketsLoaded}
            onCloneSuccess={onCloneSuccess}
          />
        </aside>

        <main className="min-w-0 flex-1 overflow-hidden bg-gray-950">{children}</main>
      </div>
    </div>
  )
}

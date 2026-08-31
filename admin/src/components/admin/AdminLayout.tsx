import { useState, type ReactNode } from 'react'
import MarketSidebar, { type AdminView } from './MarketSidebar'

interface AdminLayoutProps {
  selectedMarket: string | null
  view: AdminView
  dirtyMarket: string | null
  leadCounts: Record<string, number>
  onNavigate: (market: string | null, view: AdminView) => void
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

  function navigateAndClose(market: string | null, nextView: AdminView) {
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
          className={`absolute inset-y-0 left-0 z-20 flex w-64 transform flex-col border-r border-gray-700 bg-gray-900 transition-transform duration-200 md:relative md:z-auto md:w-56 md:translate-x-0 ${
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Account-scoped, not market-scoped — live outside MarketSidebar
              on purpose, which stays focused on markets. */}
          <div className="shrink-0 space-y-1 border-b border-gray-700 p-3">
            <button
              type="button"
              onClick={() => navigateAndClose(selectedMarket, 'users')}
              aria-current={view === 'users' ? 'page' : undefined}
              className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-medium transition-colors ${
                view === 'users' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <UsersIcon />
              Users
            </button>
            <button
              type="button"
              onClick={() => navigateAndClose(selectedMarket, 'media')}
              aria-current={view === 'media' ? 'page' : undefined}
              className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-medium transition-colors ${
                view === 'media' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <MediaIcon />
              Media
            </button>
            <button
              type="button"
              onClick={() => navigateAndClose(selectedMarket, 'analytics')}
              aria-current={view === 'analytics' ? 'page' : undefined}
              className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm font-medium transition-colors ${
                view === 'analytics' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <AnalyticsIcon />
              Analytics
            </button>
          </div>

          <div className="min-h-0 flex-1">
            <MarketSidebar
              selectedMarket={selectedMarket}
              view={view}
              dirtyMarket={dirtyMarket}
              leadCounts={leadCounts}
              onNavigate={navigateAndClose}
              onMarketsLoaded={onMarketsLoaded}
              onCloneSuccess={onCloneSuccess}
            />
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-hidden bg-gray-950">{children}</main>
      </div>
    </div>
  )
}

function UsersIcon() {
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function MediaIcon() {
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
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  )
}

function AnalyticsIcon() {
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
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  )
}

import { useEffect } from 'react'
import { clearSession, refreshSession } from '../../lib/adminAuth'

// Admin session tokens are short-lived (30 min, see
// worker/src/lib/auth.ts). This hook is what makes that livable: while the
// panel is open AND the user is actually interacting with it, it silently
// calls POST /api/admin/refresh well before the token would expire. If the
// user walks away, it stops refreshing and proactively logs them out once
// they've been idle past IDLE_TIMEOUT_MS — rather than just letting the
// stale token 401 on whatever they happen to click next.
const IDLE_TIMEOUT_MS = 10 * 60 * 1000 // 10 min idle -> logged out
const REFRESH_INTERVAL_MS = 5 * 60 * 1000 // refresh this often while active
const CHECK_INTERVAL_MS = 30 * 1000 // how often the timer wakes up to check
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const

// `enabled` should be the current auth token (or just a boolean) — pass a
// falsy value while logged out so this hook is a no-op with nothing to
// track or refresh.
export function useIdleSessionRefresh(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return

    let lastActivity = Date.now()
    let lastRefresh = Date.now()

    function markActive() {
      lastActivity = Date.now()
    }

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, markActive, { passive: true }))
    document.addEventListener('visibilitychange', markActive)

    const interval = setInterval(() => {
      const now = Date.now()

      if (now - lastActivity >= IDLE_TIMEOUT_MS) {
        clearSession()
        return
      }

      if (now - lastRefresh >= REFRESH_INTERVAL_MS) {
        lastRefresh = now
        // Fire-and-forget: refreshSession() already swallows transient
        // failures and only acts (clearSession) on a real 401.
        refreshSession()
      }
    }, CHECK_INTERVAL_MS)

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActive))
      document.removeEventListener('visibilitychange', markActive)
      clearInterval(interval)
    }
  }, [enabled])
}

import { useEffect, useState } from 'react'
import { getStoredUser, getToken, subscribeToSession, type AdminUser } from '../../lib/adminAuth'

// Route-guard state: reacts to login/logout/401-triggered session clears
// wherever they happen (LoginGate, adminFetch) via the module-level
// subscription in lib/adminAuth.
export function useAdminSession() {
  const [token, setToken] = useState<string | null>(() => getToken())
  const [user, setUser] = useState<AdminUser | null>(() => getStoredUser())

  useEffect(
    () =>
      subscribeToSession(() => {
        setToken(getToken())
        setUser(getStoredUser())
      }),
    []
  )

  return { token, user }
}

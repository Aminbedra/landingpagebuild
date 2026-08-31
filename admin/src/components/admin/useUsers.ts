import { useCallback, useEffect, useState } from 'react'
import { adminFetch } from '../../lib/adminAuth'

export type UserRole = 'super_admin' | 'client_admin' | 'viewer'

export interface AdminUserRecord {
  id: string
  email: string
  name: string | null
  role: UserRole
  created_at: string
}

interface AddUserPayload {
  email: string
  password: string
  name?: string
  role?: UserRole
}

export function useUsers() {
  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminFetch('/api/admin/users')
      if (!res.ok) throw new Error(`Failed to load users (${res.status})`)
      const json = (await res.json()) as { users: AdminUserRecord[] }
      setUsers(json.users)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Splices the changed row in place rather than refetching the whole
  // list — keeps role changes feeling instant.
  const changeRole = useCallback(async (id: string, role: UserRole) => {
    const res = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(body?.error ?? `Failed to change role (${res.status})`)
    }
    const json = (await res.json()) as { success: true; user: AdminUserRecord }
    setUsers((prev) => prev.map((u) => (u.id === id ? json.user : u)))
    return json.user
  }, [])

  const addUser = useCallback(async (payload: AddUserPayload) => {
    const res = await adminFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(body?.error ?? `Failed to create user (${res.status})`)
    }
    const json = (await res.json()) as { success: true; user: AdminUserRecord }
    setUsers((prev) => [...prev, json.user])
    return json.user
  }, [])

  return { users, loading, error, fetchUsers, changeRole, addUser }
}

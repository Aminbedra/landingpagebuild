import { useState } from 'react'
import { useUsers, type AdminUserRecord, type UserRole } from './useUsers'
import AddUserModal from './AddUserModal'
import { useAdminSession } from './useAdminSession'

const ROLES: UserRole[] = ['super_admin', 'client_admin', 'viewer']

// Account-scoped, not per-market — no `market` prop, unlike CopyEditor/
// LeadsDashboard. Same content-area pattern as those, though: top bar,
// then a table in the same container styling as LeadsDashboard's.
export default function UsersPanel() {
  const { users, loading, error, fetchUsers, changeRole, addUser } = useUsers()
  const { user: currentUser } = useAdminSession()
  const [modalOpen, setModalOpen] = useState(false)
  const [changingId, setChangingId] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)

  async function handleRoleChange(user: AdminUserRecord, role: UserRole) {
    if (role === user.role) return
    setChangingId(user.id)
    setRowError(null)
    try {
      await changeRole(user.id, role)
    } catch (e) {
      setRowError({ id: user.id, message: e instanceof Error ? e.message : 'Failed to change role' })
    } finally {
      setChangingId(null)
    }
  }

  if (error && users.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm">
        <p className="text-red-400">{error}</p>
        <button
          type="button"
          onClick={fetchUsers}
          className="rounded bg-indigo-600 px-3 py-1.5 text-white transition-colors hover:bg-indigo-500"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-100">Users</h1>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded bg-gray-700 px-3 py-1.5 text-sm text-gray-100 transition-colors hover:bg-gray-600"
          >
            Add User
          </button>
        </div>

        {loading ? (
          <SkeletonTable />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-700 bg-gray-900">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-800 text-xs tracking-wide text-gray-400 uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                  <th className="px-4 py-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = currentUser?.id === user.id
                  return (
                    <tr key={user.id} className="border-t border-gray-800 hover:bg-gray-800/50">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-100">{user.email}</td>
                      <td className="px-4 py-3 text-gray-300">{user.name ?? <span className="text-gray-600">—</span>}</td>
                      <td className="px-4 py-3">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-400">
                        {new Date(user.created_at).toLocaleDateString(undefined, {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={user.role}
                          disabled={isSelf || changingId === user.id}
                          onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                          title={isSelf ? 'You cannot change your own role' : undefined}
                          className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-100 outline-none focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        {rowError?.id === user.id && <p className="mt-1 text-xs text-red-400">{rowError.message}</p>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddUserModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        // No-op: addUser (passed below) already splices the new row into
        // this table's shared `users` state via useUsers' closure — the
        // table re-renders without UsersPanel needing to react here too.
        onCreated={() => {}}
        addUser={addUser}
      />
    </div>
  )
}

function RoleBadge({ role }: { role: UserRole }) {
  const isSuperAdmin = role === 'super_admin'
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${
        isSuperAdmin ? 'bg-indigo-600/20 text-indigo-400' : 'bg-gray-700 text-gray-300'
      }`}
    >
      {role}
    </span>
  )
}

function SkeletonTable() {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-900">
      <div className="divide-y divide-gray-800">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <div className="h-3 w-40 animate-pulse rounded bg-gray-800" />
            <div className="h-3 w-24 animate-pulse rounded bg-gray-800" />
            <div className="h-3 w-20 animate-pulse rounded bg-gray-800" />
            <div className="h-3 flex-1 animate-pulse rounded bg-gray-800" />
          </div>
        ))}
      </div>
    </div>
  )
}

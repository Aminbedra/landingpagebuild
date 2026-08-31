import { useState, type FormEvent } from 'react'
import type { AdminUserRecord, UserRole } from './useUsers'

interface AddUserModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (user: AdminUserRecord) => void
  addUser: (payload: { email: string; password: string; name?: string; role?: UserRole }) => Promise<AdminUserRecord>
}

const inputClass =
  'w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100 outline-none focus:border-indigo-500'

// A real modal, like CloneMarketModal — not a drawer like
// VersionHistoryPanel. Creating a user is a focused one-shot action, not
// something you'd want visible alongside other content.
export default function AddUserModal({ isOpen, onClose, onCreated, addUser }: AddUserModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>('client_admin')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setEmail('')
    setPassword('')
    setName('')
    setRole('client_admin')
    setError(null)
  }

  function handleClose() {
    if (submitting) return
    reset()
    onClose()
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim() || !password) return

    setSubmitting(true)
    setError(null)
    try {
      const user = await addUser({ email: email.trim(), password, name: name.trim() || undefined, role })
      onCreated(user)
      reset()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-800 p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-user-title"
      >
        <h2 id="add-user-title" className="text-lg font-semibold text-gray-100">
          Add user
        </h2>
        <p className="mt-1 text-sm text-gray-400">Creates an account that can sign in immediately.</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-gray-400">Email</span>
            <input
              type="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-gray-400">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-gray-400">Name (optional)</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-gray-400">Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={inputClass}>
              <option value="client_admin">client_admin</option>
              <option value="super_admin">super_admin</option>
              <option value="viewer">viewer</option>
            </select>
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="rounded px-3 py-2 text-sm text-gray-400 hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Add user'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

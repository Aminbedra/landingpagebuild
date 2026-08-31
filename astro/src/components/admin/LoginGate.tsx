import { useState, type FormEvent } from 'react'
import { adminLogin } from '../../lib/adminAuth'

// Route guard's front door. No signup here on purpose — this panel is for
// existing super_admin accounts only (see README for how to seed one).
export default function LoginGate() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      // On success, adminLogin stores the session; AdminApp's session
      // subscription picks it up and swaps this screen out.
      await adminLogin(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-gray-950 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-gray-700 bg-gray-900 p-6">
        <h1 className="mb-1 text-lg font-semibold text-gray-100">Admin sign in</h1>
        <p className="mb-5 text-sm text-gray-400">LandingPageBuild admin panel</p>

        {error && (
          <div className="mb-4 rounded border border-red-600/40 bg-red-600/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-gray-400">Email</span>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 outline-none focus:border-indigo-500"
          />
        </label>

        <label className="mb-5 block text-sm">
          <span className="mb-1 block text-gray-400">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 outline-none focus:border-indigo-500"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

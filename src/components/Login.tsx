import { useState } from 'react'
import { api } from '../lib/api'

/** Full-screen login. Calls onSuccess after the cookie is set so the app can hydrate. */
export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.login(email.trim(), password)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="card login-card" onSubmit={submit}>
        <div className="brand" style={{ padding: '0 0 18px' }}>
          <span className="brand-badge">$</span>
          <span>Finance</span>
        </div>
        <h2 style={{ marginBottom: 4 }}>Sign in</h2>
        <p className="dim" style={{ fontSize: 13, marginTop: 0, marginBottom: 18 }}>
          Enter your household credentials to view your finances.
        </p>

        <div className="field">
          <label>Email</label>
          <input
            type="email"
            autoFocus
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p style={{ color: 'var(--red)', fontSize: 13, margin: '0 0 12px' }}>{error}</p>
        )}

        <button className="btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

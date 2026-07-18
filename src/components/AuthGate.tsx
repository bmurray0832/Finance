import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { hydrateFromServer } from '../store/useStore'
import Login from './Login'

type Status = 'loading' | 'in' | 'out'

/** Gates the whole app behind login and hydrates shared state once authenticated. */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')

  async function enter() {
    setStatus('loading')
    await hydrateFromServer()
    setStatus('in')
  }

  useEffect(() => {
    let cancelled = false
    api
      .me()
      .then(async ({ authenticated }) => {
        if (cancelled) return
        if (authenticated) await enter()
        else setStatus('out')
      })
      .catch(() => {
        if (!cancelled) setStatus('out')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (status === 'loading') {
    return (
      <div className="login-screen">
        <div className="dim">Loading…</div>
      </div>
    )
  }
  if (status === 'out') {
    return <Login onSuccess={enter} />
  }
  return <>{children}</>
}

// Thin client for the backend API. Same-origin, cookie-based auth.

import type { AppState } from '../types'

async function req(path: string, opts: RequestInit = {}): Promise<Response> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  return res
}

async function jsonOrThrow(res: Response) {
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      // no JSON body
    }
    throw new Error(message)
  }
  return res.status === 204 ? null : res.json()
}

export const api = {
  async me(): Promise<{ authenticated: boolean }> {
    return jsonOrThrow(await req('/api/me'))
  },
  async login(email: string, password: string): Promise<void> {
    await jsonOrThrow(
      await req('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    )
  },
  async logout(): Promise<void> {
    await jsonOrThrow(await req('/api/logout', { method: 'POST' }))
  },
  async getState(): Promise<Partial<AppState>> {
    return jsonOrThrow(await req('/api/state'))
  },
  async putState(state: AppState): Promise<void> {
    await jsonOrThrow(await req('/api/state', { method: 'PUT', body: JSON.stringify(state) }))
  },
}

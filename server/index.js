// Express server for the finance tracker.
// Serves the built SPA (dist/) and a tiny JSON API for auth + shared state.

import express from 'express'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { storeReady, backendName } from './store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROD = process.env.NODE_ENV === 'production'
const PORT = process.env.PORT || 3000
const JWT_SECRET = process.env.JWT_SECRET || (PROD ? '' : 'dev-insecure-secret')
const COOKIE = 'ft_token'

if (PROD && !JWT_SECRET) {
  console.error('FATAL: JWT_SECRET must be set in production.')
  process.exit(1)
}

const store = await storeReady
await store.init()

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '8mb' }))
app.use(cookieParser())

function sign(email) {
  return jwt.sign({ sub: email }, JWT_SECRET, { expiresIn: '30d' })
}

function verify(req) {
  const token = req.cookies?.[COOKIE]
  if (!token) return null
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

function requireAuth(req, res, next) {
  const user = verify(req)
  if (!user) return res.status(401).json({ error: 'Not authenticated' })
  req.user = user
  next()
}

// Simple in-memory login throttle: 10 failures / 15 min per IP.
const attempts = new Map()
function throttled(ip) {
  const rec = attempts.get(ip)
  if (!rec) return false
  if (Date.now() - rec.first > 15 * 60 * 1000) {
    attempts.delete(ip)
    return false
  }
  return rec.count >= 10
}
function recordFail(ip) {
  const rec = attempts.get(ip) || { count: 0, first: Date.now() }
  rec.count += 1
  attempts.set(ip, rec)
}

app.get('/api/health', (_req, res) => res.json({ ok: true, backend: backendName }))

app.get('/api/me', (req, res) => {
  res.json({ authenticated: !!verify(req) })
})

app.post('/api/login', async (req, res) => {
  const ip = req.ip
  if (throttled(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' })
  }
  const email = String(req.body?.email || '').toLowerCase().trim()
  const password = String(req.body?.password || '')
  const user = await store.getUser(email)
  const ok = user && (await bcrypt.compare(password, user.password_hash))
  if (!ok) {
    recordFail(ip)
    return res.status(401).json({ error: 'Invalid email or password.' })
  }
  attempts.delete(ip)
  res.cookie(COOKIE, sign(user.email), {
    httpOnly: true,
    secure: PROD,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  })
  res.json({ authenticated: true })
})

app.post('/api/logout', (_req, res) => {
  res.clearCookie(COOKIE)
  res.status(204).end()
})

app.get('/api/state', requireAuth, async (_req, res) => {
  res.json(await store.getState())
})

app.put('/api/state', requireAuth, async (req, res) => {
  const data = req.body
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'Invalid state payload.' })
  }
  await store.setState(data)
  res.status(204).end()
})

// Static SPA + fallback (HashRouter means only '/' is ever requested, but this
// keeps any direct path working too).
const dist = path.join(__dirname, '..', 'dist')
app.use(express.static(dist))
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')))

app.listen(PORT, () => {
  console.log(`Finance tracker server on :${PORT} (storage: ${backendName})`)
  if (!process.env.AUTH_EMAIL || !process.env.AUTH_PASSWORD) {
    console.warn('WARNING: AUTH_EMAIL / AUTH_PASSWORD not set — no account seeded, login will fail.')
  }
})

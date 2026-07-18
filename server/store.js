// Storage layer for the finance tracker backend.
//
// Two backends, chosen at runtime:
//   - Postgres  (when DATABASE_URL is set) — used in production on Railway.
//   - JSON file (otherwise) — a zero-dependency fallback for local dev/testing.
//
// The data model is deliberately tiny: a single shared "household" state
// document (one row) plus a single shared user account. Both spouses log in
// with the same credentials and see the same state.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const USE_PG = !!process.env.DATABASE_URL

/** Hash the seed password from env, so credentials never live in the DB in plaintext. */
async function seedUserRecord() {
  const email = (process.env.AUTH_EMAIL || '').toLowerCase().trim()
  const password = process.env.AUTH_PASSWORD || ''
  if (!email || !password) return null
  const password_hash = await bcrypt.hash(password, 10)
  return { email, password_hash }
}

// --- Postgres backend ------------------------------------------------------

function makePgStore() {
  // Lazy import so the file backend doesn't need `pg` installed at runtime.
  return import('pg').then(({ default: pkg }) => {
    const { Pool } = pkg
    const ssl =
      process.env.DATABASE_SSL === 'true' || process.env.PGSSLMODE === 'require'
        ? { rejectUnauthorized: false }
        : false
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl })

    return {
      async init() {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS app_user (
            id serial PRIMARY KEY,
            email text UNIQUE NOT NULL,
            password_hash text NOT NULL
          );
        `)
        await pool.query(`
          CREATE TABLE IF NOT EXISTS app_state (
            id int PRIMARY KEY DEFAULT 1,
            data jsonb NOT NULL DEFAULT '{}'::jsonb,
            updated_at timestamptz NOT NULL DEFAULT now()
          );
        `)
        await pool.query(
          `INSERT INTO app_state (id, data) VALUES (1, '{}'::jsonb) ON CONFLICT (id) DO NOTHING;`,
        )
        const seed = await seedUserRecord()
        if (seed) {
          // Upsert the shared account; updating the hash lets the owner rotate
          // the password by changing AUTH_PASSWORD and redeploying.
          await pool.query(
            `INSERT INTO app_user (email, password_hash) VALUES ($1, $2)
             ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;`,
            [seed.email, seed.password_hash],
          )
        }
      },
      async getUser(email) {
        const { rows } = await pool.query(
          `SELECT email, password_hash FROM app_user WHERE email = $1 LIMIT 1;`,
          [email],
        )
        return rows[0] || null
      },
      async getState() {
        const { rows } = await pool.query(`SELECT data FROM app_state WHERE id = 1;`)
        return rows[0]?.data ?? {}
      },
      async setState(data) {
        await pool.query(
          `INSERT INTO app_state (id, data, updated_at) VALUES (1, $1, now())
           ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now();`,
          [data],
        )
      },
    }
  })
}

// --- JSON file backend (dev/testing) --------------------------------------

function makeFileStore() {
  const file = process.env.DATA_FILE || path.join(__dirname, '.data.json')
  let db = { user: null, state: {} }

  function load() {
    try {
      db = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch {
      db = { user: null, state: {} }
    }
  }
  function save() {
    fs.writeFileSync(file, JSON.stringify(db, null, 2))
  }

  return Promise.resolve({
    async init() {
      load()
      const seed = await seedUserRecord()
      if (seed) {
        db.user = seed
        save()
      }
    },
    async getUser(email) {
      return db.user && db.user.email === email ? db.user : null
    },
    async getState() {
      return db.state ?? {}
    },
    async setState(data) {
      db.state = data
      save()
    },
  })
}

export const storeReady = USE_PG ? makePgStore() : makeFileStore()
export const backendName = USE_PG ? 'postgres' : 'file'

import { useRef, useState } from 'react'
import { actions, useStore } from '../store/useStore'
import { buildBackup, parseBackup } from '../lib/backup'

type Msg = { kind: 'ok' | 'err'; text: string }

export default function Settings() {
  const state = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<Msg | null>(null)

  const counts = {
    transactions: state.transactions.length,
    debts: state.debts.length,
    goals: state.goals.length,
    rules: state.rules.length,
  }
  const isEmpty =
    counts.transactions === 0 && counts.debts === 0 && counts.goals === 0

  function exportBackup() {
    const backup = buildBackup(state)
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finance-backup-${backup.exportedAt.slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setMsg({ kind: 'ok', text: 'Backup downloaded.' })
  }

  async function importBackup(file: File) {
    try {
      const next = parseBackup(await file.text())
      const summary = `${next.transactions.length} transactions, ${next.debts.length} debts, ${next.goals.length} goals, ${next.rules.length} rules`
      const ok = confirm(
        `Restore this backup?\n\nThis will REPLACE all current data with:\n${summary}\n\nThis cannot be undone — export your current data first if you want to keep it.`,
      )
      if (!ok) return
      actions.replaceAll(next)
      setMsg({ kind: 'ok', text: `Restored ${summary}.` })
    } catch (e) {
      setMsg({ kind: 'err', text: 'Could not restore: ' + (e instanceof Error ? e.message : String(e)) })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <div className="page-subtitle">Back up your household data or keep an offline copy</div>
        </div>
      </div>

      {msg && (
        <div
          className="card mb-24"
          style={{
            borderColor: msg.kind === 'ok' ? 'var(--green)' : 'var(--red)',
            background:
              msg.kind === 'ok' ? 'rgba(53,192,127,0.06)' : 'rgba(242,114,114,0.06)',
          }}
        >
          <div className="row">
            <span>{msg.text}</span>
          </div>
        </div>
      )}

      <div className="card mb-24">
        <div className="section-title">Backup &amp; restore</div>
        <p className="dim" style={{ marginTop: 0 }}>
          Your data is synced to your private household account and shared with everyone who signs
          in. Export a JSON backup any time to keep an offline safety copy.
        </p>

        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginTop: 16 }}>
          <div className="card" style={{ background: 'var(--bg)' }}>
            <div className="row-between">
              <strong>Export</strong>
              <span className="chip">.json</span>
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              Download everything — transactions, debts, goals, rules, and saved column mappings.
            </p>
            <button className="btn-primary mt-8" onClick={exportBackup} disabled={isEmpty}>
              Export backup
            </button>
            {isEmpty && <p className="hint">Nothing to export yet.</p>}
          </div>

          <div className="card" style={{ background: 'var(--bg)' }}>
            <div className="row-between">
              <strong>Restore</strong>
              <span className="chip">replaces all</span>
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              Load a backup file. This replaces all current data in this browser.
            </p>
            <button className="btn mt-8" onClick={() => fileRef.current?.click()}>
              Restore from file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) importBackup(f)
              }}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Your household account holds</div>
        <table>
          <tbody>
            <tr>
              <td>Transactions</td>
              <td className="num">{counts.transactions}</td>
            </tr>
            <tr>
              <td>Debts</td>
              <td className="num">{counts.debts}</td>
            </tr>
            <tr>
              <td>Savings goals</td>
              <td className="num">{counts.goals}</td>
            </tr>
            <tr>
              <td>Category rules</td>
              <td className="num">{counts.rules}</td>
            </tr>
          </tbody>
        </table>
        <p className="hint">
          This is synced to your household account, so it's shared across your devices. A JSON
          backup is still handy as an offline safety copy.
        </p>
      </div>
    </div>
  )
}

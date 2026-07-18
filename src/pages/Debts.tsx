import { useMemo, useState } from 'react'
import { actions, useStore } from '../store/useStore'
import type { Debt } from '../types'
import { formatCurrency, formatPercent } from '../lib/format'

/** Avalanche order: highest interest first, then largest balance. */
function rankDebts(debts: Debt[]): Debt[] {
  return [...debts].sort((a, b) => {
    if (b.interestRate !== a.interestRate) return b.interestRate - a.interestRate
    return b.balance - a.balance
  })
}

const EMPTY_FORM = { name: '', balance: '', interestRate: '', minPayment: '' }

export default function Debts() {
  const { debts } = useStore()
  const ranked = useMemo(() => rankDebts(debts), [debts])
  const [editing, setEditing] = useState<Debt | null>(null)
  const [showForm, setShowForm] = useState(false)

  const totalOwed = debts.reduce((s, d) => s + d.balance, 0)
  const totalMin = debts.reduce((s, d) => s + (d.minPayment ?? 0), 0)
  const weightedApr =
    totalOwed > 0 ? debts.reduce((s, d) => s + d.interestRate * d.balance, 0) / totalOwed : 0
  const monthlyInterest = debts.reduce((s, d) => s + (d.balance * (d.interestRate / 100)) / 12, 0)

  function openAdd() {
    setEditing(null)
    setShowForm(true)
  }
  function openEdit(d: Debt) {
    setEditing(d)
    setShowForm(true)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Debt Payoff</h1>
          <div className="page-subtitle">
            Ranked by interest rate, then balance — the avalanche method that minimizes interest paid
          </div>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          + Add debt
        </button>
      </div>

      {debts.length === 0 ? (
        <div className="card empty">
          <h3>No debts tracked</h3>
          <p className="dim" style={{ margin: '8px 0 20px' }}>
            Add your loans and credit cards to see which to attack first.
          </p>
          <button className="btn-primary" onClick={openAdd}>
            Add a debt
          </button>
        </div>
      ) : (
        <>
          <div className="grid stat-grid">
            <div className="card stat-card">
              <div className="stat-label">Total owed</div>
              <div className="stat-value neg">{formatCurrency(totalOwed)}</div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">Avg. APR (weighted)</div>
              <div className="stat-value">{formatPercent(weightedApr)}</div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">Interest / month</div>
              <div className="stat-value neg">{formatCurrency(monthlyInterest)}</div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">Min. payments / month</div>
              <div className="stat-value">{formatCurrency(totalMin)}</div>
            </div>
          </div>

          {ranked[0] && (
            <div
              className="card mb-24"
              style={{ borderColor: 'var(--amber)', background: 'rgba(240,180,41,0.06)' }}
            >
              <div className="row">
                <div>
                  <strong>Focus on {ranked[0].name} first.</strong>{' '}
                  <span className="dim">
                    At {formatPercent(ranked[0].interestRate)} APR it's your most expensive debt.
                    Pay the minimum on everything else and throw every spare dollar here.
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Debt</th>
                    <th className="num">Interest (APR)</th>
                    <th className="num">Balance</th>
                    <th className="num">Min. payment</th>
                    <th className="num">Interest / mo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((d, i) => (
                    <tr key={d.id}>
                      <td>
                        <span className={'rank-badge' + (i === 0 ? ' rank-1' : '')}>{i + 1}</span>
                      </td>
                      <td>
                        <strong>{d.name}</strong>
                      </td>
                      <td className="num">{formatPercent(d.interestRate)}</td>
                      <td className="num">{formatCurrency(d.balance)}</td>
                      <td className="num dim">
                        {d.minPayment ? formatCurrency(d.minPayment) : '—'}
                      </td>
                      <td className="num dim">
                        {formatCurrency((d.balance * (d.interestRate / 100)) / 12)}
                      </td>
                      <td>
                        <div className="row">
                          <button className="btn-sm btn-ghost" onClick={() => openEdit(d)}>
                            Edit
                          </button>
                          <button
                            className="btn-danger btn-sm"
                            onClick={() => {
                              if (confirm(`Delete "${d.name}"?`)) actions.deleteDebt(d.id)
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showForm && (
        <DebtForm debt={editing} onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}

function DebtForm({ debt, onClose }: { debt: Debt | null; onClose: () => void }) {
  const [form, setForm] = useState(
    debt
      ? {
          name: debt.name,
          balance: String(debt.balance),
          interestRate: String(debt.interestRate),
          minPayment: debt.minPayment != null ? String(debt.minPayment) : '',
        }
      : EMPTY_FORM,
  )

  const valid = form.name.trim() && form.balance !== '' && form.interestRate !== ''

  function save() {
    if (!valid) return
    const payload = {
      name: form.name.trim(),
      balance: Math.abs(parseFloat(form.balance) || 0),
      interestRate: Math.abs(parseFloat(form.interestRate) || 0),
      minPayment: form.minPayment ? Math.abs(parseFloat(form.minPayment)) : undefined,
    }
    if (debt) actions.updateDebt(debt.id, payload)
    else actions.addDebt(payload)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row-between mb-24">
          <h2>{debt ? 'Edit debt' : 'Add debt'}</h2>
          <button className="btn-ghost btn-sm" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="field">
          <label>Name</label>
          <input
            autoFocus
            value={form.name}
            placeholder="e.g. Visa card"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="form-row">
          <div className="field">
            <label>Balance owed</label>
            <input
              type="number"
              inputMode="decimal"
              value={form.balance}
              placeholder="0.00"
              onChange={(e) => setForm({ ...form, balance: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Interest rate (APR %)</label>
            <input
              type="number"
              inputMode="decimal"
              value={form.interestRate}
              placeholder="19.99"
              onChange={(e) => setForm({ ...form, interestRate: e.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label>Minimum monthly payment (optional)</label>
          <input
            type="number"
            inputMode="decimal"
            value={form.minPayment}
            placeholder="0.00"
            onChange={(e) => setForm({ ...form, minPayment: e.target.value })}
          />
        </div>

        <div className="divider" />
        <div className="row-between">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={!valid}>
            {debt ? 'Save changes' : 'Add debt'}
          </button>
        </div>
      </div>
    </div>
  )
}

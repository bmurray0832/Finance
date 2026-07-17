import { useState } from 'react'
import { actions, useStore } from '../store/useStore'
import type { Goal } from '../types'
import { formatCurrency, formatDate, formatPercent } from '../lib/format'

const EMPTY = { name: '', targetAmount: '', currentAmount: '', targetDate: '', note: '' }

export default function Goals() {
  const { goals } = useStore()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Goal | null>(null)

  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0)
  const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0)

  function openAdd() {
    setEditing(null)
    setShowForm(true)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Savings Goals</h1>
          <div className="page-subtitle">Track progress toward the things you're saving for</div>
        </div>
        <button className="btn-primary" onClick={openAdd}>
          + Add goal
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon">🎯</div>
          <h3>No goals yet</h3>
          <p className="dim" style={{ margin: '8px 0 20px' }}>
            Set a target — an emergency fund, a trip, a new laptop — and track your progress.
          </p>
          <button className="btn-primary" onClick={openAdd}>
            Create a goal
          </button>
        </div>
      ) : (
        <>
          <div className="grid stat-grid">
            <div className="card stat-card">
              <div className="stat-label">Total saved</div>
              <div className="stat-value pos">{formatCurrency(totalSaved)}</div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">Total target</div>
              <div className="stat-value">{formatCurrency(totalTarget)}</div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">Overall progress</div>
              <div className="stat-value">
                {formatPercent(totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0, 0)}
              </div>
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {goals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                onEdit={() => {
                  setEditing(g)
                  setShowForm(true)
                }}
              />
            ))}
          </div>
        </>
      )}

      {showForm && <GoalForm goal={editing} onClose={() => setShowForm(false)} />}
    </div>
  )
}

function GoalCard({ goal, onEdit }: { goal: Goal; onEdit: () => void }) {
  const pct = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)
  const complete = goal.currentAmount >= goal.targetAmount && goal.targetAmount > 0

  function contribute() {
    const raw = prompt(`Add to "${goal.name}" — amount to contribute:`, '')
    if (raw == null) return
    const amt = parseFloat(raw)
    if (isNaN(amt)) return
    actions.updateGoal(goal.id, { currentAmount: Math.max(0, goal.currentAmount + amt) })
  }

  return (
    <div className="card">
      <div className="row-between">
        <h3>{goal.name}</h3>
        {complete && <span className="tag" style={{ background: 'rgba(53,192,127,0.15)', color: 'var(--green)', borderColor: 'rgba(53,192,127,0.3)' }}>Reached 🎉</span>}
      </div>
      {goal.note && <p className="hint" style={{ marginTop: 4 }}>{goal.note}</p>}

      <div className="row-between" style={{ margin: '16px 0 8px' }}>
        <span>
          <strong style={{ fontSize: 18 }}>{formatCurrency(goal.currentAmount)}</strong>{' '}
          <span className="dim">of {formatCurrency(goal.targetAmount)}</span>
        </span>
        <span className="chip">{formatPercent(pct, 0)}</span>
      </div>
      <div className="progress">
        <div className="progress-bar" style={{ width: pct + '%' }} />
      </div>

      <div className="row-between mt-8" style={{ marginTop: 12 }}>
        <span className="hint" style={{ marginTop: 0 }}>
          {complete ? 'Goal complete' : `${formatCurrency(remaining)} to go`}
          {goal.targetDate ? ` · by ${formatDate(goal.targetDate)}` : ''}
        </span>
      </div>

      <div className="divider" style={{ margin: '14px 0' }} />
      <div className="row gap-wrap">
        <button className="btn-sm btn-primary" onClick={contribute}>
          + Contribute
        </button>
        <button className="btn-sm btn-ghost" onClick={onEdit}>
          Edit
        </button>
        <button
          className="btn-danger btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => {
            if (confirm(`Delete goal "${goal.name}"?`)) actions.deleteGoal(goal.id)
          }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

function GoalForm({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const [form, setForm] = useState(
    goal
      ? {
          name: goal.name,
          targetAmount: String(goal.targetAmount),
          currentAmount: String(goal.currentAmount),
          targetDate: goal.targetDate ?? '',
          note: goal.note ?? '',
        }
      : EMPTY,
  )

  const valid = form.name.trim() && form.targetAmount !== ''

  function save() {
    if (!valid) return
    const payload = {
      name: form.name.trim(),
      targetAmount: Math.abs(parseFloat(form.targetAmount) || 0),
      currentAmount: Math.abs(parseFloat(form.currentAmount) || 0),
      targetDate: form.targetDate || undefined,
      note: form.note.trim() || undefined,
    }
    if (goal) actions.updateGoal(goal.id, payload)
    else actions.addGoal(payload)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row-between mb-24">
          <h2>{goal ? 'Edit goal' : 'Add goal'}</h2>
          <button className="btn-ghost btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="field">
          <label>Goal name</label>
          <input
            autoFocus
            value={form.name}
            placeholder="e.g. Emergency fund"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="form-row">
          <div className="field">
            <label>Target amount</label>
            <input
              type="number"
              inputMode="decimal"
              value={form.targetAmount}
              placeholder="5000"
              onChange={(e) => setForm({ ...form, targetAmount: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Saved so far</label>
            <input
              type="number"
              inputMode="decimal"
              value={form.currentAmount}
              placeholder="0"
              onChange={(e) => setForm({ ...form, currentAmount: e.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label>Target date (optional)</label>
          <input
            type="date"
            value={form.targetDate}
            onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Note (optional)</label>
          <input
            value={form.note}
            placeholder="What's this for?"
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </div>

        <div className="divider" />
        <div className="row-between">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={!valid}>
            {goal ? 'Save changes' : 'Add goal'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { actions, useStore } from '../store/useStore'
import { detectRecurring, cadenceLabel, type RecurringPattern } from '../lib/recurring'
import { buildForecast, runningBalance, computeSafeToSpend } from '../lib/cashflow'
import { formatCurrency, formatDate } from '../lib/format'

const HORIZONS = [30, 60, 90]

export default function CashFlow() {
  const { transactions, currentBalance, currentBalanceUpdatedAt, dismissedRecurring } = useStore()
  const [horizon, setHorizon] = useState(60)
  const [showDismissed, setShowDismissed] = useState(false)

  const allPatterns = useMemo(() => detectRecurring(transactions), [transactions])
  const activePatterns = useMemo(
    () => allPatterns.filter((p) => !dismissedRecurring.includes(p.key)),
    [allPatterns, dismissedRecurring],
  )
  const dismissedPatterns = useMemo(
    () => allPatterns.filter((p) => dismissedRecurring.includes(p.key)),
    [allPatterns, dismissedRecurring],
  )

  const events = useMemo(() => buildForecast(activePatterns, horizon), [activePatterns, horizon])
  const points = useMemo(() => runningBalance(currentBalance, events), [currentBalance, events])
  const safe = useMemo(() => computeSafeToSpend(currentBalance, points), [currentBalance, points])

  function editBalance() {
    const raw = prompt('Current account balance:', String(currentBalance))
    if (raw == null) return
    const amt = parseFloat(raw)
    if (isNaN(amt)) return
    actions.setCurrentBalance(amt)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cash Flow</h1>
          <div className="page-subtitle">
            Forecasted from bills and income that repeat in your transaction history
          </div>
        </div>
        <div className="segmented">
          {HORIZONS.map((h) => (
            <button
              key={h}
              className={'segmented-btn' + (horizon === h ? ' active' : '')}
              onClick={() => setHorizon(h)}
            >
              {h}d
            </button>
          ))}
        </div>
      </div>

      <div className="card mb-24">
        <div className="row-between gap-wrap">
          <div>
            <div className="stat-label">Current balance</div>
            <div className="stat-value">{formatCurrency(currentBalance)}</div>
            <div className="hint" style={{ marginTop: 4 }}>
              {currentBalanceUpdatedAt
                ? `Updated ${formatDate(currentBalanceUpdatedAt.slice(0, 10))}`
                : 'Not set yet — enter your real balance for an accurate forecast'}
            </div>
          </div>
          <button className="btn" onClick={editBalance}>
            {currentBalanceUpdatedAt ? 'Update balance' : 'Set balance'}
          </button>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon">📈</div>
          <h3>No transactions yet</h3>
          <p className="dim" style={{ margin: '8px 0 0' }}>
            Import statements first — the forecast learns your bills and income from history.
          </p>
        </div>
      ) : allPatterns.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon">🔍</div>
          <h3>No recurring bills or income detected yet</h3>
          <p
            className="dim"
            style={{ margin: '8px auto 0', maxWidth: 420 }}
          >
            Import a few months of statements — the forecast needs at least 3 matching occurrences of a
            bill or paycheck to recognize its schedule.
          </p>
        </div>
      ) : (
        <>
          <div className="grid stat-grid mb-24">
            <div
              className="card stat-card"
              style={safe.amount < 0 ? { borderColor: 'var(--red)', background: 'rgba(242,114,114,0.06)' } : undefined}
            >
              <div className="stat-label">Safe to spend now</div>
              <div className={'stat-value ' + (safe.amount >= 0 ? 'pos' : 'neg')}>
                {formatCurrency(safe.amount)}
              </div>
              <div className="hint" style={{ marginTop: 4 }}>
                {safe.throughDate
                  ? `Through your next projected income on ${formatDate(safe.throughDate)}`
                  : `Over the next ${horizon} days — no income pattern detected`}
              </div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">Lowest projected balance</div>
              <div className={'stat-value ' + (safe.lowestBalance >= 0 ? '' : 'neg')}>
                {formatCurrency(safe.lowestBalance)}
              </div>
              <div className="hint" style={{ marginTop: 4 }}>
                {safe.lowestDate ? `Around ${formatDate(safe.lowestDate)}` : 'No bills projected yet'}
              </div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">Upcoming in {horizon} days</div>
              <div className="stat-value">{events.length}</div>
              <div className="hint" style={{ marginTop: 4 }}>
                {activePatterns.length} recurring {activePatterns.length === 1 ? 'pattern' : 'patterns'} tracked
              </div>
            </div>
          </div>

          {safe.amount < 0 && (
            <div
              className="card mb-24"
              style={{ borderColor: 'var(--red)', background: 'rgba(242,114,114,0.06)' }}
            >
              <div className="row">
                <span style={{ fontSize: 22 }}>⚠️</span>
                <div>
                  <strong>Your balance is projected to go negative.</strong>{' '}
                  <span className="dim">
                    Around {safe.lowestDate ? formatDate(safe.lowestDate) : 'the period shown'}, you're
                    projected to be short by {formatCurrency(Math.abs(safe.lowestBalance))} before your
                    next income arrives.
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="card mb-24">
            <div className="section-title">Upcoming ({horizon} days)</div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Item</th>
                    <th>Category</th>
                    <th className="num">Amount</th>
                    <th className="num">Balance after</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((p, i) => (
                    <tr key={p.key + p.date + i}>
                      <td className="dim" style={{ whiteSpace: 'nowrap' }}>
                        {formatDate(p.date)}
                      </td>
                      <td>
                        {p.label} <span className="hint">· {cadenceLabel(p.cadence)}</span>
                      </td>
                      <td>
                        <span className="chip">{p.category}</span>
                      </td>
                      <td className={'num ' + (p.amount < 0 ? 'neg' : 'pos')}>{formatCurrency(p.amount)}</td>
                      <td className={'num ' + (p.balance < 0 ? 'neg' : '')}>{formatCurrency(p.balance)}</td>
                    </tr>
                  ))}
                  {points.length === 0 && (
                    <tr>
                      <td colSpan={5} className="dim" style={{ textAlign: 'center', padding: 24 }}>
                        Nothing projected in this window.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="row-between mb-24">
              <div className="section-title" style={{ marginBottom: 0 }}>
                Detected recurring bills &amp; income
              </div>
              {dismissedPatterns.length > 0 && (
                <button className="btn-ghost btn-sm" onClick={() => setShowDismissed((s) => !s)}>
                  {showDismissed ? 'Hide' : 'Show'} dismissed ({dismissedPatterns.length})
                </button>
              )}
            </div>
            <p className="hint" style={{ marginTop: 0 }}>
              Found automatically from repeating transactions — at least 3 occurrences on a consistent
              schedule and amount. Dismiss anything that isn't really a recurring bill or paycheck.
            </p>
            <RecurringTable patterns={activePatterns} dismissed={false} />
            {showDismissed && dismissedPatterns.length > 0 && (
              <>
                <div className="divider" />
                <RecurringTable patterns={dismissedPatterns} dismissed />
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function RecurringTable({ patterns, dismissed }: { patterns: RecurringPattern[]; dismissed: boolean }) {
  if (patterns.length === 0) {
    return (
      <p className="dim" style={{ textAlign: 'center', padding: 16 }}>
        Nothing here.
      </p>
    )
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Category</th>
            <th>Cadence</th>
            <th className="num">Amount</th>
            <th className="num">Seen</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {patterns.map((p) => (
            <tr key={p.key}>
              <td>
                {p.label}
                {p.confidence === 'medium' && <span className="hint"> · low confidence</span>}
              </td>
              <td>
                <span className="chip">{p.category}</span>
              </td>
              <td className="dim">{cadenceLabel(p.cadence)}</td>
              <td className={'num ' + (p.amount < 0 ? 'neg' : 'pos')}>{formatCurrency(p.amount)}</td>
              <td className="num dim">{p.occurrences}×</td>
              <td>
                <button className="btn-sm btn-ghost" onClick={() => actions.setRecurringDismissed(p.key, !dismissed)}>
                  {dismissed ? 'Restore' : 'Dismiss'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

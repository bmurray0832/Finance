import { useMemo, useState } from 'react'
import { actions, useStore } from '../store/useStore'
import { INCOME } from '../lib/categorize'
import {
  availablePeriods,
  budgetLevelClass,
  budgetStatus,
  categoryBreakdown,
  filterByPeriod,
  periodLabel,
} from '../lib/analytics'
import { formatCurrency, formatPercent } from '../lib/format'

export default function Budgets() {
  const { transactions, budgets } = useStore()
  const [newCat, setNewCat] = useState('')
  const [newAmt, setNewAmt] = useState('')

  // Reference month = most recent month present in the data (what "actual" compares against).
  const months = useMemo(() => availablePeriods(transactions, 'month'), [transactions])
  const refMonth = months[0] ?? null
  const refLabel = refMonth ? periodLabel(refMonth, 'month') : 'this month'

  const actualByCat = useMemo(() => {
    const map = new Map<string, number>()
    if (!refMonth) return map
    const monthTxns = filterByPeriod(transactions, 'month', refMonth)
    for (const b of categoryBreakdown(monthTxns)) map.set(b.category, b.total)
    return map
  }, [transactions, refMonth])

  // Every category worth budgeting: those seen in the data plus any already budgeted.
  const categories = useMemo(() => {
    const set = new Set<string>()
    transactions.forEach((t) => {
      if (t.category !== INCOME) set.add(t.category)
    })
    Object.keys(budgets).forEach((c) => set.add(c))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [transactions, budgets])

  const totalBudget = Object.values(budgets).reduce((s, v) => s + v, 0)
  const totalActual = categories.reduce((s, c) => s + (actualByCat.get(c) ?? 0), 0)
  const overall = budgetStatus(totalActual, totalBudget)

  function addBudget() {
    const amt = parseFloat(newAmt)
    if (!newCat.trim() || isNaN(amt) || amt <= 0) return
    actions.setBudget(newCat.trim(), amt)
    setNewCat('')
    setNewAmt('')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Budgets</h1>
          <div className="page-subtitle">
            Set a monthly budget per category. Actuals compare against {refLabel}.
          </div>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="card empty">
          <h3>No transactions yet</h3>
          <p className="dim" style={{ margin: '8px 0 0' }}>
            Import statements first — then set a monthly budget for each spending category.
          </p>
        </div>
      ) : (
        <>
          <div className="grid stat-grid">
            <div className="card stat-card">
              <div className="stat-label">Total monthly budget</div>
              <div className="stat-value">{formatCurrency(totalBudget)}</div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">Spent ({refLabel})</div>
              <div className="stat-value">{formatCurrency(totalActual)}</div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">{overall.delta > 0 ? 'Over by' : 'Remaining'}</div>
              <div className={'stat-value ' + budgetLevelClass(overall.level)}>
                {formatCurrency(Math.abs(overall.delta))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="section-title">Monthly budget by category</div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="num">Monthly budget</th>
                    <th className="num">Spent ({refLabel})</th>
                    <th className="num">Delta</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => {
                    const planned = budgets[cat] ?? 0
                    const actual = actualByCat.get(cat) ?? 0
                    const status = budgetStatus(actual, planned)
                    return (
                      <tr key={cat}>
                        <td>{cat}</td>
                        <td className="num">
                          <input
                            type="number"
                            inputMode="decimal"
                            className="budget-input"
                            placeholder="—"
                            value={budgets[cat] != null ? String(budgets[cat]) : ''}
                            onChange={(e) => actions.setBudget(cat, parseFloat(e.target.value))}
                          />
                        </td>
                        <td className="num">{formatCurrency(actual)}</td>
                        <td className="num">
                          {planned > 0 ? (
                            <span className={budgetLevelClass(status.level)}>
                              {status.delta > 0 ? '+' : ''}
                              {formatCurrency(status.delta)}{' '}
                              <span style={{ fontSize: 12 }}>
                                ({formatPercent(Math.abs(status.pct), 0)}{' '}
                                {status.delta > 0 ? 'over' : 'left'})
                              </span>
                            </span>
                          ) : (
                            <span className="dim">no budget</span>
                          )}
                        </td>
                        <td className="num">
                          {planned > 0 && (
                            <button
                              className="btn-danger btn-sm"
                              title="Clear budget"
                              onClick={() => actions.setBudget(cat, 0)}
                            >
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {categories.length === 0 && (
                    <tr>
                      <td colSpan={5} className="dim" style={{ textAlign: 'center', padding: 24 }}>
                        No spending categories yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="divider" />
            <div className="section-title">Add a budget for another category</div>
            <div className="form-row" style={{ alignItems: 'flex-end' }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Category</label>
                <input
                  value={newCat}
                  list="budget-categories"
                  placeholder="e.g. Travel"
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addBudget()}
                />
                <datalist id="budget-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Monthly budget</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={newAmt}
                  placeholder="0.00"
                  onChange={(e) => setNewAmt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addBudget()}
                />
              </div>
              <button
                className="btn-primary"
                onClick={addBudget}
                disabled={!newCat.trim() || !(parseFloat(newAmt) > 0)}
                style={{ marginBottom: 0 }}
              >
                Set budget
              </button>
            </div>
            <p className="hint">
              Stoplight colors on the Dashboard: green = at or under budget, amber = up to 10% over,
              red = more than 10% over.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

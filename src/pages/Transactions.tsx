import { useMemo, useState } from 'react'
import { actions, useStore } from '../store/useStore'
import ImportModal from '../components/ImportModal'
import PeriodFilter from '../components/PeriodFilter'
import { formatCurrency, formatDate } from '../lib/format'
import { availablePeriods, filterByPeriod, type PeriodType } from '../lib/analytics'

/** Sentinel value for the "add a new category" option in the inline selector. */
const NEW_CATEGORY = '__new_category__'

export default function Transactions() {
  const { transactions } = useStore()
  const [importing, setImporting] = useState(false)
  const [periodType, setPeriodType] = useState<PeriodType>('month')
  const [period, setPeriod] = useState('all')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const periods = useMemo(() => availablePeriods(transactions, periodType), [transactions, periodType])

  const categories = useMemo(() => {
    const set = new Set<string>()
    transactions.forEach((t) => set.add(t.category))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [transactions])

  const rows = useMemo(() => {
    let r = filterByPeriod(transactions, periodType, period)
    if (categoryFilter !== 'all') {
      r = r.filter((t) => t.category === categoryFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(
        (t) =>
          t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q),
      )
    }
    return [...r].sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [transactions, periodType, period, search, categoryFilter])

  /** Assign a category to a transaction, prompting for a name when "New category…" is picked. */
  function handleCategoryChange(id: string, value: string) {
    if (value === NEW_CATEGORY) {
      const name = prompt('New category name:')?.trim()
      if (name) actions.updateTransactionCategory(id, name)
      return
    }
    actions.updateTransactionCategory(id, value)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Transactions</h1>
          <div className="page-subtitle">{transactions.length} imported · edit a category to override</div>
        </div>
        <div className="row gap-wrap">
          {transactions.length > 0 && (
            <button
              className="btn-ghost"
              onClick={() => {
                if (confirm('Remove ALL transactions? This cannot be undone.')) {
                  actions.clearTransactions()
                }
              }}
            >
              Clear all
            </button>
          )}
          <button className="btn-primary" onClick={() => setImporting(true)}>
            + Import CSV
          </button>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="card empty">
          <h3>Nothing imported yet</h3>
          <p className="dim" style={{ margin: '8px 0 20px' }}>
            Import a bank statement to get started.
          </p>
          <button className="btn-primary" onClick={() => setImporting(true)}>
            Import CSV
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="row-between mb-24 gap-wrap">
            <div className="row gap-wrap">
              <input
                placeholder="Search description or category…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ maxWidth: 280 }}
              />
              <select
                className="inline-select"
                value={categories.includes(categoryFilter) ? categoryFilter : 'all'}
                onChange={(e) => setCategoryFilter(e.target.value)}
                title="Filter by category"
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <PeriodFilter
              type={periodType}
              period={period}
              periods={periods}
              onChange={(t, p) => {
                setPeriodType(t)
                setPeriod(p)
              }}
            />
          </div>

          <div className="row-between mb-24 gap-wrap">
            <span className="dim" style={{ fontSize: 13 }}>
              Showing {rows.length} of {transactions.length}
            </span>
            {(categoryFilter !== 'all' || period !== 'all' || search.trim()) && (
              <button
                className="btn-ghost btn-sm"
                onClick={() => {
                  setCategoryFilter('all')
                  setPeriod('all')
                  setSearch('')
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Account</th>
                  <th>Category</th>
                  <th className="num">Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td className="dim" style={{ whiteSpace: 'nowrap' }}>{formatDate(t.date)}</td>
                    <td>{t.description || <span className="dim">—</span>}</td>
                    <td className="dim">{t.account || '—'}</td>
                    <td>
                      <select
                        className="inline-select"
                        value={t.category}
                        onChange={(e) => handleCategoryChange(t.id, e.target.value)}
                      >
                        {[...new Set([t.category, ...categories])].map((c) => (
                          <option key={c} value={c}>
                            {c}
                            {t.categoryLocked && c === t.category ? ' •' : ''}
                          </option>
                        ))}
                        <option disabled>──────────</option>
                        <option value={NEW_CATEGORY}>+ New category…</option>
                      </select>
                    </td>
                    <td className={'num ' + (t.amount < 0 ? 'neg' : 'pos')}>
                      {formatCurrency(t.amount)}
                    </td>
                    <td>
                      <button
                        className="btn-danger btn-sm"
                        title="Delete"
                        onClick={() => actions.deleteTransaction(t.id)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="dim" style={{ textAlign: 'center', padding: 24 }}>
                      No transactions match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {importing && <ImportModal onClose={() => setImporting(false)} />}
    </div>
  )
}

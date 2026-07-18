import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { Transaction } from '../types'
import { useStore } from '../store/useStore'
import ImportModal from '../components/ImportModal'
import PeriodFilter from '../components/PeriodFilter'
import {
  availablePeriods,
  categoryBreakdown,
  colorFor,
  computeTotals,
  filterByPeriod,
  periodLabel,
  type PeriodType,
} from '../lib/analytics'
import { formatCurrency, formatDate, formatPercent } from '../lib/format'

export default function Dashboard() {
  const { transactions } = useStore()
  const [importing, setImporting] = useState(false)
  const [periodType, setPeriodType] = useState<PeriodType>('month')
  const [period, setPeriod] = useState('all')
  const [drillCategory, setDrillCategory] = useState<string | null>(null)

  const periods = useMemo(() => availablePeriods(transactions, periodType), [transactions, periodType])
  const filtered = useMemo(
    () => filterByPeriod(transactions, periodType, period),
    [transactions, periodType, period],
  )
  const totals = useMemo(() => computeTotals(filtered), [filtered])
  const breakdown = useMemo(() => categoryBreakdown(filtered), [filtered])

  const pieData = breakdown.map((b, i) => ({
    name: b.category,
    value: b.total,
    color: colorFor(i),
  }))

  const periodText = period === 'all' ? 'All time' : periodLabel(period, periodType)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="page-subtitle">Spending by category from your imported statements</div>
        </div>
        <div className="row gap-wrap">
          {transactions.length > 0 && (
            <PeriodFilter
              type={periodType}
              period={period}
              periods={periods}
              onChange={(t, p) => {
                setPeriodType(t)
                setPeriod(p)
              }}
            />
          )}
          <button className="btn-primary" onClick={() => setImporting(true)}>
            + Import CSV
          </button>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="card empty">
          <div className="empty-icon">📥</div>
          <h3>No transactions yet</h3>
          <p className="dim" style={{ maxWidth: 380, margin: '8px auto 20px' }}>
            Import a bank statement CSV to see a per-category breakdown of your spending. Your data
            stays entirely in your browser.
          </p>
          <button className="btn-primary" onClick={() => setImporting(true)}>
            Import your first statement
          </button>
        </div>
      ) : (
        <>
          <div className="grid stat-grid">
            <div className="card stat-card">
              <div className="stat-label">Income</div>
              <div className="stat-value pos">{formatCurrency(totals.income)}</div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">Expenses</div>
              <div className="stat-value neg">{formatCurrency(totals.expenses)}</div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">Net</div>
              <div className={'stat-value ' + (totals.net >= 0 ? 'pos' : 'neg')}>
                {formatCurrency(totals.net)}
              </div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">Transactions</div>
              <div className="stat-value">{filtered.length}</div>
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'minmax(260px, 1fr) 1.4fr' }}>
            <div className="card">
              <div className="section-title">Spending mix</div>
              {breakdown.length === 0 ? (
                <p className="dim">No expenses in this period.</p>
              ) : (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={62}
                        outerRadius={100}
                        paddingAngle={2}
                        stroke="none"
                        onClick={(entry) => {
                          const name = (entry as { name?: string })?.name
                          if (name) setDrillCategory(name)
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          background: '#1e222b',
                          border: '1px solid #2a2f3a',
                          borderRadius: 8,
                          color: '#e6e9ef',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="card">
              <div className="section-title">Category breakdown</div>
              {breakdown.length === 0 ? (
                <p className="dim">No expenses in this period.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th className="num">Spent</th>
                      <th className="num">Share</th>
                      <th className="num">#</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((b, i) => (
                      <tr
                        key={b.category}
                        className="clickable-row"
                        onClick={() => setDrillCategory(b.category)}
                        title={`View ${b.category} transactions`}
                      >
                        <td>
                          <span className="row">
                            <span
                              className="legend-dot"
                              style={{ background: colorFor(i) }}
                            />
                            {b.category}
                            <span className="drill-cue" aria-hidden>
                              ›
                            </span>
                          </span>
                        </td>
                        <td className="num">{formatCurrency(b.total)}</td>
                        <td className="num dim">{formatPercent(b.share)}</td>
                        <td className="num dim">{b.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="hint mt-8">
                Click a category to see its transactions ·{' '}
                <Link to="/transactions" style={{ color: 'var(--accent)' }}>
                  Edit transactions →
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      {importing && <ImportModal onClose={() => setImporting(false)} />}
      {drillCategory && (
        <CategoryDrillDown
          category={drillCategory}
          periodText={periodText}
          transactions={filtered}
          onClose={() => setDrillCategory(null)}
        />
      )}
    </div>
  )
}

/** Modal listing the expense transactions behind a category, within the current period. */
function CategoryDrillDown({
  category,
  periodText,
  transactions,
  onClose,
}: {
  category: string
  periodText: string
  transactions: Transaction[]
  onClose: () => void
}) {
  const rows = useMemo(
    () =>
      transactions
        .filter((t) => t.category === category && t.amount < 0)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [transactions, category],
  )
  const total = rows.reduce((s, t) => s + Math.abs(t.amount), 0)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="row-between mb-24">
          <div>
            <h2>{category}</h2>
            <div className="page-subtitle" style={{ marginTop: 2 }}>
              {periodText} · {rows.length} transaction{rows.length === 1 ? '' : 's'} ·{' '}
              <strong className="neg">{formatCurrency(total)}</strong> spent
            </div>
          </div>
          <button className="btn-ghost btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>

        {rows.length === 0 ? (
          <p className="dim">No spending transactions in this category for this period.</p>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: '58vh' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Account</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td className="dim" style={{ whiteSpace: 'nowrap' }}>{formatDate(t.date)}</td>
                    <td>{t.description || <span className="dim">—</span>}</td>
                    <td className="dim">{t.account || '—'}</td>
                    <td className="num neg">{formatCurrency(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="divider" />
        <div className="row-between">
          <span className="hint" style={{ marginTop: 0 }}>
            Showing money-out transactions only (matches the category total).
          </span>
          <Link to="/transactions" className="btn btn-sm" onClick={onClose}>
            Open in Transactions →
          </Link>
        </div>
      </div>
    </div>
  )
}

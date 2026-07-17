import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useStore } from '../store/useStore'
import ImportModal from '../components/ImportModal'
import {
  availableMonths,
  categoryBreakdown,
  colorFor,
  computeTotals,
  filterByMonth,
  monthLabel,
} from '../lib/analytics'
import { formatCurrency, formatPercent } from '../lib/format'

export default function Dashboard() {
  const { transactions } = useStore()
  const [importing, setImporting] = useState(false)
  const [month, setMonth] = useState('all')

  const months = useMemo(() => availableMonths(transactions), [transactions])
  const filtered = useMemo(() => filterByMonth(transactions, month), [transactions, month])
  const totals = useMemo(() => computeTotals(filtered), [filtered])
  const breakdown = useMemo(() => categoryBreakdown(filtered), [filtered])

  const pieData = breakdown.map((b, i) => ({
    name: b.category,
    value: b.total,
    color: colorFor(i),
  }))

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="page-subtitle">Spending by category from your imported statements</div>
        </div>
        <div className="row gap-wrap">
          {months.length > 0 && (
            <select
              className="inline-select"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              <option value="all">All time</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
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
                      <tr key={b.category}>
                        <td>
                          <span className="row">
                            <span
                              className="legend-dot"
                              style={{ background: colorFor(i) }}
                            />
                            {b.category}
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
                Want to fix a miscategorized item?{' '}
                <Link to="/transactions" style={{ color: 'var(--accent)' }}>
                  Edit transactions →
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      {importing && <ImportModal onClose={() => setImporting(false)} />}
    </div>
  )
}

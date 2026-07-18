import { useMemo, useState } from 'react'
import { actions, useStore } from '../store/useStore'

export default function Rules() {
  const { rules, transactions } = useStore()
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('')

  const existingCategories = useMemo(() => {
    const set = new Set<string>()
    rules.forEach((r) => set.add(r.category))
    transactions.forEach((t) => set.add(t.category))
    return Array.from(set).sort()
  }, [rules, transactions])

  function add() {
    if (!keyword.trim() || !category.trim()) return
    actions.addRule(keyword, category)
    actions.reapplyRules()
    setKeyword('')
    setCategory('')
  }

  const sorted = [...rules].sort((a, b) =>
    a.category === b.category
      ? a.keyword.localeCompare(b.keyword)
      : a.category.localeCompare(b.category),
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Category Rules</h1>
          <div className="page-subtitle">
            When a transaction's description contains a keyword, it's auto-assigned this category
          </div>
        </div>
        <button className="btn" onClick={() => actions.reapplyRules()}>
          Re-apply to all
        </button>
      </div>

      <div className="card mb-24">
        <div className="section-title">Add a rule</div>
        <div className="form-row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>If description contains…</label>
            <input
              value={keyword}
              placeholder="e.g. netflix"
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>…set category to</label>
            <input
              value={category}
              placeholder="e.g. Subscriptions"
              list="rule-categories"
              onChange={(e) => setCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <datalist id="rule-categories">
              {existingCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <button
            className="btn-primary"
            onClick={add}
            disabled={!keyword.trim() || !category.trim()}
            style={{ marginBottom: 0 }}
          >
            Add rule
          </button>
        </div>
        <p className="hint">
          Rules apply top-to-bottom; the first keyword match wins. Manually-set categories (marked •)
          are never overwritten.
        </p>
      </div>

      <div className="card">
        <div className="section-title">{rules.length} rules</div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Keyword</th>
                <th>Category</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id}>
                  <td>
                    <code
                      style={{
                        background: 'var(--bg-elev-2)',
                        padding: '2px 8px',
                        borderRadius: 6,
                      }}
                    >
                      {r.keyword}
                    </code>
                  </td>
                  <td>
                    <span className="chip">{r.category}</span>
                  </td>
                  <td className="num">
                    <button
                      className="btn-danger btn-sm"
                      onClick={() => {
                        actions.deleteRule(r.id)
                        actions.reapplyRules()
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={3} className="dim" style={{ textAlign: 'center', padding: 24 }}>
                    No rules yet. Add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

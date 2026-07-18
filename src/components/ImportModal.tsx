import { useMemo, useState } from 'react'
import {
  parseCsvFile,
  headerSignature,
  guessMapping,
  rowsToTransactions,
  isDuplicate,
  type ParsedCsv,
} from '../lib/csv'
import type { ColumnMapping } from '../types'
import { actions, useStore } from '../store/useStore'
import { formatCurrency, formatDate } from '../lib/format'

interface Props {
  onClose: () => void
}

type Step = 'select' | 'map'

export default function ImportModal({ onClose }: Props) {
  const { savedMappings, rules, transactions } = useStore()
  const [step, setStep] = useState<Step>('select')
  const [parsed, setParsed] = useState<ParsedCsv | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping | null>(null)
  const [account, setAccount] = useState('')
  const [error, setError] = useState('')
  const [skipDuplicates, setSkipDuplicates] = useState(true)

  async function handleFile(file: File) {
    setError('')
    try {
      const result = await parseCsvFile(file)
      if (!result.headers.length || !result.rows.length) {
        setError('That file has no readable rows. Is it a CSV with a header row?')
        return
      }
      const sig = headerSignature(result.headers)
      const saved = savedMappings[sig]
      setParsed(result)
      setMapping(saved ?? guessMapping(result.headers))
      if (!account) setAccount(file.name.replace(/\.csv$/i, ''))
      setStep('map')
    } catch (e) {
      setError('Could not parse that file: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const preview = useMemo(() => {
    if (!parsed || !mapping) return []
    return rowsToTransactions(parsed.rows.slice(0, 6), mapping, rules, account || undefined)
  }, [parsed, mapping, rules, account])

  function setField(field: keyof ColumnMapping, value: string | boolean) {
    setMapping((m) => (m ? { ...m, [field]: value } : m))
  }

  function commit() {
    if (!parsed || !mapping) return
    const all = rowsToTransactions(parsed.rows, mapping, rules, account || undefined)
    let toAdd = all
    if (skipDuplicates) {
      toAdd = all.filter((t) => !transactions.some((existing) => isDuplicate(existing, t)))
    }
    actions.addTransactions(toAdd)
    actions.saveMapping(headerSignature(parsed.headers), mapping)
    onClose()
  }

  const headers = parsed?.headers ?? []
  const useSplit = mapping ? mapping.amount === undefined : false
  const skipped = parsed && mapping ? parsed.rows.length : 0

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="row-between mb-24">
          <h2>Import transactions</h2>
          <button className="btn-ghost btn-sm" onClick={onClose}>
            ×
          </button>
        </div>

        {step === 'select' && (
          <div>
            <FileDrop onFile={handleFile} />
            {error && <p className="hint" style={{ color: 'var(--red)' }}>{error}</p>}
            <p className="hint mt-8">
              Works with any bank export. Your file is parsed locally in the browser — it never
              leaves your device.
            </p>
          </div>
        )}

        {step === 'map' && mapping && (
          <div>
            <p className="hint" style={{ marginTop: 0 }}>
              Match your CSV's columns to the fields below. We'll remember this for next time.
            </p>

            <div className="form-row">
              <div className="field">
                <label>Date column</label>
                <ColSelect value={mapping.date} headers={headers} onChange={(v) => setField('date', v)} />
              </div>
              <div className="field">
                <label>Description column</label>
                <ColSelect
                  value={mapping.description}
                  headers={headers}
                  onChange={(v) => setField('description', v)}
                />
              </div>
            </div>

            <div className="field">
              <label>Amount style</label>
              <div className="row gap-wrap">
                <button
                  className={'btn-sm' + (!useSplit ? ' btn-primary' : '')}
                  onClick={() => setMapping((m) => (m ? { ...m, amount: headers[0], debit: undefined, credit: undefined } : m))}
                >
                  Single signed amount
                </button>
                <button
                  className={'btn-sm' + (useSplit ? ' btn-primary' : '')}
                  onClick={() => setMapping((m) => (m ? { ...m, amount: undefined, debit: headers[0], credit: headers[0] } : m))}
                >
                  Separate debit / credit
                </button>
              </div>
            </div>

            {!useSplit ? (
              <div className="form-row">
                <div className="field">
                  <label>Amount column</label>
                  <ColSelect
                    value={mapping.amount ?? ''}
                    headers={headers}
                    onChange={(v) => setField('amount', v)}
                  />
                </div>
                <div className="field" style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <label className="row" style={{ marginBottom: 10, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      style={{ width: 'auto' }}
                      checked={!!mapping.expensesArePositive}
                      onChange={(e) => setField('expensesArePositive', e.target.checked)}
                    />
                    <span>Positive numbers are expenses</span>
                  </label>
                </div>
              </div>
            ) : (
              <div className="form-row">
                <div className="field">
                  <label>Debit (money out) column</label>
                  <ColSelect
                    value={mapping.debit ?? ''}
                    headers={headers}
                    onChange={(v) => setField('debit', v)}
                  />
                </div>
                <div className="field">
                  <label>Credit (money in) column</label>
                  <ColSelect
                    value={mapping.credit ?? ''}
                    headers={headers}
                    onChange={(v) => setField('credit', v)}
                  />
                </div>
              </div>
            )}

            <div className="field">
              <label>Account name (optional)</label>
              <input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="e.g. Chase Checking" />
            </div>

            <div className="divider" />
            <div className="section-title">Preview</div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th className="num">Amount</th>
                    <th>Category</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((t) => (
                    <tr key={t.id}>
                      <td>{formatDate(t.date)}</td>
                      <td>{t.description || <span className="dim">—</span>}</td>
                      <td className={'num ' + (t.amount < 0 ? 'neg' : 'pos')}>
                        {formatCurrency(t.amount)}
                      </td>
                      <td>
                        <span className="chip">{t.category}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <label className="row mt-8" style={{ cursor: 'pointer', marginTop: 16 }}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
              />
              <span>Skip rows that duplicate existing transactions</span>
            </label>

            <div className="divider" />
            <div className="row-between">
              <button className="btn-ghost" onClick={() => setStep('select')}>
                ← Choose a different file
              </button>
              <button className="btn-primary" onClick={commit} disabled={!mapping.date || !mapping.description}>
                Import {skipped} rows
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ColSelect({
  value,
  headers,
  onChange,
}: {
  value: string
  headers: string[]
  onChange: (v: string) => void
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— none —</option>
      {headers.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
  )
}

function FileDrop({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false)
  return (
    <label
      className="card"
      style={{
        display: 'block',
        textAlign: 'center',
        padding: '40px 20px',
        cursor: 'pointer',
        borderStyle: 'dashed',
        borderColor: dragging ? 'var(--accent)' : 'var(--border)',
        background: dragging ? 'rgba(79,140,255,0.06)' : 'var(--bg-elev)',
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (file) onFile(file)
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Drop a bank statement CSV here</div>
      <div className="hint" style={{ marginTop: 0 }}>or click to browse</div>
      <input
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
        }}
      />
    </label>
  )
}

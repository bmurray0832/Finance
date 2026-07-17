import Papa from 'papaparse'
import type { ColumnMapping, Transaction } from '../types'
import { categorize } from './categorize'
import type { CategoryRule } from '../types'
import { makeId } from './format'

export interface ParsedCsv {
  headers: string[]
  rows: Record<string, string>[]
}

/** Parse a CSV File into headers + row objects. */
export function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        const headers = results.meta.fields ?? []
        resolve({ headers, rows: results.data })
      },
      error: (err) => reject(err),
    })
  })
}

/** A stable signature for a CSV's header row, used to remember mappings per bank format. */
export function headerSignature(headers: string[]): string {
  return headers.map((h) => h.trim().toLowerCase()).join('|')
}

/** Guess a sensible default mapping from header names. */
export function guessMapping(headers: string[]): ColumnMapping {
  const find = (candidates: string[]) =>
    headers.find((h) => candidates.some((c) => h.toLowerCase().includes(c)))

  const date = find(['date', 'posted', 'transaction date']) ?? headers[0] ?? ''
  const description =
    find(['description', 'memo', 'name', 'details', 'payee', 'narrative']) ?? headers[1] ?? ''
  const debit = find(['debit', 'withdrawal', 'money out', 'paid out'])
  const credit = find(['credit', 'deposit', 'money in', 'paid in'])
  const amount = find(['amount', 'value'])

  const mapping: ColumnMapping = { date, description }
  if (debit && credit) {
    mapping.debit = debit
    mapping.credit = credit
  } else if (amount) {
    mapping.amount = amount
  } else if (debit) {
    mapping.debit = debit
  }
  return mapping
}

function parseNumber(raw: string | undefined): number {
  if (!raw) return 0
  // Strip currency symbols, spaces, thousands separators; handle parentheses as negative.
  let s = raw.trim()
  const negative = /^\(.*\)$/.test(s)
  s = s.replace(/[()]/g, '')
  s = s.replace(/[^0-9.\-]/g, '')
  const n = parseFloat(s)
  if (isNaN(n)) return 0
  return negative ? -Math.abs(n) : n
}

function parseDate(raw: string | undefined): string {
  if (!raw) return ''
  const s = raw.trim()
  // Already ISO-ish?
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  // mm/dd/yyyy or dd/mm/yyyy or m/d/yy — assume mm/dd/yyyy (common in US bank exports).
  const slash = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/.exec(s)
  if (slash) {
    let [, mm, dd, yyyy] = slash
    if (yyyy.length === 2) yyyy = '20' + yyyy
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }

  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`
  }
  return s
}

/** Convert parsed CSV rows into Transactions using the chosen column mapping. */
export function rowsToTransactions(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  rules: CategoryRule[],
  account?: string,
): Transaction[] {
  const out: Transaction[] = []
  for (const row of rows) {
    const date = parseDate(row[mapping.date])
    const description = (row[mapping.description] ?? '').trim()

    let amount = 0
    if (mapping.amount) {
      amount = parseNumber(row[mapping.amount])
      if (mapping.expensesArePositive) amount = -amount
    } else {
      const debit = mapping.debit ? Math.abs(parseNumber(row[mapping.debit])) : 0
      const credit = mapping.credit ? Math.abs(parseNumber(row[mapping.credit])) : 0
      amount = credit - debit
    }

    // Skip fully empty rows.
    if (!description && !amount && !date) continue

    out.push({
      id: makeId(),
      date,
      description,
      amount,
      category: categorize(description, amount, rules),
      account,
    })
  }
  return out
}

/** Simple duplicate check: same date, description, and amount. */
export function isDuplicate(a: Transaction, b: Transaction): boolean {
  return a.date === b.date && a.description === b.description && a.amount === b.amount
}

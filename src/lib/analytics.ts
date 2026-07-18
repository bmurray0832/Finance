import type { Transaction } from '../types'
import { INCOME } from './categorize'

export interface CategoryTotal {
  category: string
  total: number // absolute spend
  count: number
  share: number // 0..100 of total expenses
}

/** yyyy-mm month key, or 'all'. Used internally by the period helpers below. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

export function monthLabel(key: string): string {
  if (key === 'all') return 'All time'
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

// ---- Period filtering (month / quarter / year) ---------------------------
// Lets the Dashboard/Transactions filters break spending down by month,
// quarter, or year instead of just by month.

export type PeriodType = 'month' | 'quarter' | 'year'

/** Period key for a given granularity, e.g. '2026-07', '2026-Q3', or '2026'. */
export function periodKey(iso: string, type: PeriodType): string {
  if (!iso) return ''
  if (type === 'month') return monthKey(iso)
  const year = iso.slice(0, 4)
  if (type === 'year') return year
  const month = Number(iso.slice(5, 7))
  const quarter = Math.floor((month - 1) / 3) + 1
  return `${year}-Q${quarter}`
}

export function periodLabel(key: string, type: PeriodType): string {
  if (key === 'all') return 'All time'
  if (type === 'month') return monthLabel(key)
  if (type === 'year') return key
  // 'YYYY-QN'
  const [year, q] = key.split('-')
  return `${q} ${year}`
}

/** Distinct periods present in the data, newest first. */
export function availablePeriods(txns: Transaction[], type: PeriodType): string[] {
  const set = new Set<string>()
  for (const t of txns) {
    if (t.date) set.add(periodKey(t.date, type))
  }
  return Array.from(set).sort().reverse()
}

export function filterByPeriod(txns: Transaction[], type: PeriodType, period: string): Transaction[] {
  if (period === 'all') return txns
  return txns.filter((t) => periodKey(t.date, type) === period)
}

/** Group expenses (negative amounts, excluding the Income category) by category. */
export function categoryBreakdown(txns: Transaction[]): CategoryTotal[] {
  const map = new Map<string, { total: number; count: number }>()
  for (const t of txns) {
    if (t.category === INCOME) continue
    if (t.amount >= 0) continue // only outflows count as spending
    const spend = Math.abs(t.amount)
    const cur = map.get(t.category) ?? { total: 0, count: 0 }
    cur.total += spend
    cur.count += 1
    map.set(t.category, cur)
  }
  const grand = Array.from(map.values()).reduce((s, v) => s + v.total, 0)
  return Array.from(map.entries())
    .map(([category, v]) => ({
      category,
      total: v.total,
      count: v.count,
      share: grand > 0 ? (v.total / grand) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

export interface Totals {
  income: number
  expenses: number
  net: number
}

export function computeTotals(txns: Transaction[]): Totals {
  let income = 0
  let expenses = 0
  for (const t of txns) {
    if (t.amount >= 0) income += t.amount
    else expenses += Math.abs(t.amount)
  }
  return { income, expenses, net: income - expenses }
}

/** Stable-ish color palette for categories. */
const PALETTE = [
  '#4f8cff',
  '#a78bfa',
  '#35c07f',
  '#f0b429',
  '#f27272',
  '#38bdf8',
  '#fb7185',
  '#34d399',
  '#c084fc',
  '#fbbf24',
  '#60a5fa',
  '#4ade80',
]

export function colorFor(index: number): string {
  return PALETTE[index % PALETTE.length]
}

/** Number of distinct calendar months present in a set of transactions (min 1). */
export function distinctMonthCount(txns: Transaction[]): number {
  const set = new Set<string>()
  for (const t of txns) {
    if (t.date) set.add(t.date.slice(0, 7))
  }
  return Math.max(1, set.size)
}

export type BudgetLevel = 'under' | 'warn' | 'over'

export interface BudgetStatus {
  planned: number
  actual: number
  /** actual - planned; positive means over budget. */
  delta: number
  /** delta as a percent of planned (0 when no budget). */
  pct: number
  level: BudgetLevel
}

/**
 * Compare actual spend against a planned budget and classify it into a
 * stoplight level: under/on budget (green), slightly over ≤10% (amber),
 * or well over >10% (red).
 */
export function budgetStatus(actual: number, planned: number): BudgetStatus {
  const delta = actual - planned
  const pct = planned > 0 ? (delta / planned) * 100 : 0
  let level: BudgetLevel = 'under'
  if (planned > 0 && delta > 0) level = pct <= 10 ? 'warn' : 'over'
  return { planned, actual, delta, pct, level }
}

/** CSS class for a budget level's stoplight text color. */
export function budgetLevelClass(level: BudgetLevel): string {
  return level === 'over' ? 'neg' : level === 'warn' ? 'warn' : 'pos'
}

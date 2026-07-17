// Detects recurring bills and income from transaction history so the cash
// flow forecast can predict when money leaves and arrives, without the user
// having to enter a schedule by hand.

import type { Transaction } from '../types'

export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual'

export interface RecurringPattern {
  /** Stable identity for a pattern (normalized description). Used for dismiss/restore. */
  key: string
  /** Most recent transaction's description, for display. */
  label: string
  category: string
  /** Signed average amount — negative = bill, positive = income. */
  amount: number
  cadence: Cadence
  /** Typical calendar day (1-31) for monthly/quarterly/annual cadences. Unset for weekly/biweekly. */
  dayOfMonth?: number
  /** ISO date of the most recent observed occurrence — the projection anchor. */
  lastDate: string
  occurrences: number
  confidence: 'high' | 'medium'
}

interface CadenceRange {
  cadence: Cadence
  minDays: number
  maxDays: number
  typicalDays: number
}

const CADENCE_RANGES: CadenceRange[] = [
  { cadence: 'weekly', minDays: 5, maxDays: 9, typicalDays: 7 },
  { cadence: 'biweekly', minDays: 12, maxDays: 16, typicalDays: 14 },
  { cadence: 'monthly', minDays: 26, maxDays: 34, typicalDays: 30 },
  { cadence: 'quarterly', minDays: 82, maxDays: 100, typicalDays: 91 },
  { cadence: 'annual', minDays: 350, maxDays: 380, typicalDays: 365 },
]

/** Strip digits, punctuation, and extra whitespace so "NETFLIX.COM 08/12" and "NETFLIX.COM 09/12" group together. */
function normalizeDescription(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/\d+/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime()
  const db = new Date(b + 'T00:00:00').getTime()
  return Math.round((db - da) / 86400000)
}

/**
 * Scan transaction history for groups of same-merchant transactions that
 * repeat on a roughly fixed interval with a roughly fixed amount. Requires
 * at least 3 occurrences so a couple of coincidental matches can't pass.
 */
export function detectRecurring(transactions: Transaction[]): RecurringPattern[] {
  const groups = new Map<string, Transaction[]>()
  for (const t of transactions) {
    if (!t.date || !t.description) continue
    const key = normalizeDescription(t.description)
    if (!key) continue
    const list = groups.get(key) ?? []
    list.push(t)
    groups.set(key, list)
  }

  const patterns: RecurringPattern[] = []

  for (const [key, group] of groups) {
    if (group.length < 3) continue

    // A clean recurring bill or paycheck doesn't flip between money-in and money-out.
    const signs = new Set(group.map((t) => (t.amount >= 0 ? 1 : -1)))
    if (signs.size > 1) continue

    const sorted = [...group].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    const gaps: number[] = []
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(daysBetween(sorted[i - 1].date, sorted[i].date))
    }
    const medianGap = median(gaps)

    const range = CADENCE_RANGES.find((r) => medianGap >= r.minDays && medianGap <= r.maxDays)
    if (!range) continue

    // Every gap should be reasonably close to the matched cadence, not just the median.
    const tolerance = range.typicalDays * 0.35 + 4
    const gapsConsistent = gaps.every((g) => Math.abs(g - range.typicalDays) <= tolerance)
    if (!gapsConsistent) continue

    const amounts = sorted.map((t) => t.amount)
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length
    const amountTolerance = Math.abs(avgAmount) * 0.35 + 5
    const amountsConsistent = amounts.every((a) => Math.abs(a - avgAmount) <= amountTolerance)
    if (!amountsConsistent) continue

    const last = sorted[sorted.length - 1]
    const dayOfMonth =
      range.cadence === 'weekly' || range.cadence === 'biweekly'
        ? undefined
        : Math.round(median(sorted.map((t) => Number(t.date.slice(8, 10)))))

    const categoryCounts = new Map<string, number>()
    for (const t of sorted) categoryCounts.set(t.category, (categoryCounts.get(t.category) ?? 0) + 1)
    const category = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]

    patterns.push({
      key,
      label: last.description,
      category,
      amount: avgAmount,
      cadence: range.cadence,
      dayOfMonth,
      lastDate: last.date,
      occurrences: sorted.length,
      confidence: sorted.length >= 4 ? 'high' : 'medium',
    })
  }

  return patterns.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
}

export function cadenceLabel(cadence: Cadence): string {
  switch (cadence) {
    case 'weekly':
      return 'Weekly'
    case 'biweekly':
      return 'Every 2 weeks'
    case 'monthly':
      return 'Monthly'
    case 'quarterly':
      return 'Quarterly'
    case 'annual':
      return 'Yearly'
  }
}

export function cadenceIntervalDays(cadence: Cadence): number {
  return CADENCE_RANGES.find((r) => r.cadence === cadence)!.typicalDays
}

// Projects detected recurring bills/income forward into a running-balance
// forecast, and derives a "safe to spend" figure from it.

import { cadenceIntervalDays, type RecurringPattern, type Cadence } from './recurring'

export interface ForecastEvent {
  date: string // ISO yyyy-mm-dd
  key: string
  label: string
  category: string
  amount: number
  cadence: Cadence
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Project a single pattern's future occurrences from its last known date through (and including) horizonIso. */
function projectDates(pattern: RecurringPattern, horizonIso: string): string[] {
  const dates: string[] = []
  const horizon = new Date(horizonIso + 'T00:00:00')
  const anchor = new Date(pattern.lastDate + 'T00:00:00')

  const monthsStep =
    pattern.cadence === 'monthly' ? 1 : pattern.cadence === 'quarterly' ? 3 : pattern.cadence === 'annual' ? 12 : 0

  if (monthsStep > 0) {
    // Step by calendar months so a monthly bill anchored on the 31st doesn't drift when
    // stepping through 30-day months — adding N*30 days would slowly walk off the real date.
    const day = pattern.dayOfMonth ?? anchor.getDate()
    let y = anchor.getFullYear()
    let m = anchor.getMonth()
    // eslint-disable-next-line no-constant-condition
    while (true) {
      m += monthsStep
      y += Math.floor(m / 12)
      m = ((m % 12) + 12) % 12
      const daysInMonth = new Date(y, m + 1, 0).getDate()
      const d = new Date(y, m, Math.min(day, daysInMonth))
      if (d > horizon) break
      dates.push(toIso(d))
    }
  } else {
    const intervalDays = cadenceIntervalDays(pattern.cadence)
    let cursor = anchor
    // eslint-disable-next-line no-constant-condition
    while (true) {
      cursor = new Date(cursor.getTime() + intervalDays * 86400000)
      if (cursor > horizon) break
      dates.push(toIso(cursor))
    }
  }
  return dates
}

/** Build every projected occurrence of every pattern from today through horizonDays out, sorted by date. */
export function buildForecast(
  patterns: RecurringPattern[],
  horizonDays: number,
  today: Date = new Date(),
): ForecastEvent[] {
  const todayIso = toIso(today)
  const horizonIso = toIso(new Date(today.getTime() + horizonDays * 86400000))
  const events: ForecastEvent[] = []
  for (const p of patterns) {
    for (const date of projectDates(p, horizonIso)) {
      if (date < todayIso) continue
      events.push({ date, key: p.key, label: p.label, category: p.category, amount: p.amount, cadence: p.cadence })
    }
  }
  return events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

export interface RunningBalancePoint extends ForecastEvent {
  balance: number
}

/** Walk the forecast events forward from a starting balance, accumulating a running balance at each event. */
export function runningBalance(startBalance: number, events: ForecastEvent[]): RunningBalancePoint[] {
  let balance = startBalance
  return events.map((e) => {
    balance += e.amount
    return { ...e, balance }
  })
}

export interface SafeToSpend {
  /** How much could be withdrawn today without the balance dropping below zero before the next projected income. */
  amount: number
  /** Date of the next projected income event this figure is calculated through, or null if none was detected. */
  throughDate: string | null
  /** The lowest projected balance in that window, and when it occurs. */
  lowestBalance: number
  lowestDate: string | null
}

export function computeSafeToSpend(startBalance: number, points: RunningBalancePoint[]): SafeToSpend {
  const nextIncome = points.find((p) => p.amount > 0)
  const relevant = nextIncome ? points.filter((p) => p.date <= nextIncome.date) : points

  let lowest = startBalance
  let lowestDate: string | null = null
  for (const p of relevant) {
    if (p.balance < lowest) {
      lowest = p.balance
      lowestDate = p.date
    }
  }

  return {
    amount: lowest,
    throughDate: nextIncome ? nextIncome.date : null,
    lowestBalance: lowest,
    lowestDate,
  }
}

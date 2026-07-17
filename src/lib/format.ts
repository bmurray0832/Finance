// Small formatting helpers used across the app.

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
})

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value)
}

/** Absolute value formatted as currency — handy for expense totals. */
export function formatAbs(value: number): string {
  return currencyFormatter.format(Math.abs(value))
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Generate a reasonably unique id without external deps. */
export function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

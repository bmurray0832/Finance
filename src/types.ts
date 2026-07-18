// Core domain types for the finance tracker.
// Everything is stored locally in the browser — no server, no accounts.

/** A single bank transaction. `amount` is signed: negative = money out, positive = money in. */
export interface Transaction {
  id: string
  date: string // ISO yyyy-mm-dd
  description: string
  amount: number
  category: string
  account?: string
  /** True if the user manually set the category (protects it from re-categorization by rules). */
  categoryLocked?: boolean
}

/** A keyword rule that auto-assigns a category when a transaction description matches. */
export interface CategoryRule {
  id: string
  /** Case-insensitive substring to look for in the description. */
  keyword: string
  category: string
}

/** A debt to pay down. Ranked by interest rate (desc), then balance (desc) — the avalanche method. */
export interface Debt {
  id: string
  name: string
  balance: number
  interestRate: number // annual percentage, e.g. 19.99
  minPayment?: number
}

/** A savings goal. */
export interface Goal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  targetDate?: string // ISO yyyy-mm-dd
  note?: string
}

/** How a bank's CSV columns map onto our transaction fields. Remembered per header signature. */
export interface ColumnMapping {
  date: string
  description: string
  /** Single signed amount column. Use this OR (debit + credit). */
  amount?: string
  /** Separate debit (money out) column. */
  debit?: string
  /** Separate credit (money in) column. */
  credit?: string
  /** If true, a positive value in `amount` means an expense (money out). Flips the sign. */
  expensesArePositive?: boolean
}

export interface AppState {
  transactions: Transaction[]
  rules: CategoryRule[]
  debts: Debt[]
  goals: Goal[]
  /** Saved mappings keyed by a signature of the CSV header row. */
  savedMappings: Record<string, ColumnMapping>
  /** Manually-entered account balance, used as the starting point for the cash flow forecast. */
  currentBalance: number
  /** ISO timestamp of the last time currentBalance was set. Null if never set. */
  currentBalanceUpdatedAt: string | null
  /** Keys (from recurring.ts's detectRecurring) the user has hidden from the cash flow forecast. */
  dismissedRecurring: string[]
  /** Per-category monthly spending budgets, keyed by category name. */
  budgets: Record<string, number>
  /** Amount of a single paycheck (0 if not configured). */
  payAmount: number
  /** Day of week the paycheck lands, 0=Sun..6=Sat. Default 4 (Thursday). */
  payWeekday: number
}

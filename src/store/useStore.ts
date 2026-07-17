import { useCallback, useSyncExternalStore } from 'react'
import type { AppState, CategoryRule, Debt, Goal, Transaction, ColumnMapping } from '../types'
import { DEFAULT_RULES, categorize } from '../lib/categorize'
import { makeId } from '../lib/format'

const STORAGE_KEY = 'finance-tracker-state-v1'

const EMPTY_STATE: AppState = {
  transactions: [],
  rules: DEFAULT_RULES,
  debts: [],
  goals: [],
  savedMappings: {},
  currentBalance: 0,
  currentBalanceUpdatedAt: null,
  dismissedRecurring: [],
}

/**
 * Fill in any missing fields with defaults. Used both when loading from
 * localStorage and when restoring an imported backup, so older or
 * partially-shaped data (e.g. a backup from before currentBalance/
 * dismissedRecurring existed) never crashes the app.
 */
function normalizeState(parsed: Partial<AppState> | null | undefined): AppState {
  if (!parsed || typeof parsed !== 'object') return EMPTY_STATE
  return {
    transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
    rules: Array.isArray(parsed.rules) ? parsed.rules : DEFAULT_RULES,
    debts: Array.isArray(parsed.debts) ? parsed.debts : [],
    goals: Array.isArray(parsed.goals) ? parsed.goals : [],
    savedMappings:
      parsed.savedMappings && typeof parsed.savedMappings === 'object'
        ? parsed.savedMappings
        : {},
    currentBalance: typeof parsed.currentBalance === 'number' ? parsed.currentBalance : 0,
    currentBalanceUpdatedAt:
      typeof parsed.currentBalanceUpdatedAt === 'string' ? parsed.currentBalanceUpdatedAt : null,
    dismissedRecurring: Array.isArray(parsed.dismissedRecurring) ? parsed.dismissedRecurring : [],
  }
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_STATE
    return normalizeState(JSON.parse(raw) as Partial<AppState>)
  } catch {
    return EMPTY_STATE
  }
}

let state: AppState = loadState()
const listeners = new Set<() => void>()

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage may be full or unavailable; the app still works for the session.
  }
}

function setState(updater: (prev: AppState) => AppState) {
  state = updater(state)
  persist()
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return state
}

/** Subscribe a component to the whole store. */
export function useStore(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot)
}

// ---- Actions -------------------------------------------------------------

export const actions = {
  addTransactions(txns: Transaction[]) {
    setState((prev) => ({ ...prev, transactions: [...prev.transactions, ...txns] }))
  },

  updateTransactionCategory(id: string, category: string) {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) =>
        t.id === id ? { ...t, category, categoryLocked: true } : t,
      ),
    }))
  },

  deleteTransaction(id: string) {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => t.id !== id),
    }))
  },

  clearTransactions() {
    setState((prev) => ({ ...prev, transactions: [] }))
  },

  // Rules --------------------------------------------------------------
  addRule(keyword: string, category: string) {
    const rule: CategoryRule = { id: makeId(), keyword: keyword.trim(), category: category.trim() }
    setState((prev) => ({ ...prev, rules: [...prev.rules, rule] }))
  },

  deleteRule(id: string) {
    setState((prev) => ({ ...prev, rules: prev.rules.filter((r) => r.id !== id) }))
  },

  /** Re-run rules against every transaction that the user hasn't manually locked. */
  reapplyRules() {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) =>
        t.categoryLocked ? t : { ...t, category: categorize(t.description, t.amount, prev.rules) },
      ),
    }))
  },

  // Debts --------------------------------------------------------------
  addDebt(debt: Omit<Debt, 'id'>) {
    setState((prev) => ({ ...prev, debts: [...prev.debts, { ...debt, id: makeId() }] }))
  },

  updateDebt(id: string, patch: Partial<Omit<Debt, 'id'>>) {
    setState((prev) => ({
      ...prev,
      debts: prev.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }))
  },

  deleteDebt(id: string) {
    setState((prev) => ({ ...prev, debts: prev.debts.filter((d) => d.id !== id) }))
  },

  // Goals --------------------------------------------------------------
  addGoal(goal: Omit<Goal, 'id'>) {
    setState((prev) => ({ ...prev, goals: [...prev.goals, { ...goal, id: makeId() }] }))
  },

  updateGoal(id: string, patch: Partial<Omit<Goal, 'id'>>) {
    setState((prev) => ({
      ...prev,
      goals: prev.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    }))
  },

  deleteGoal(id: string) {
    setState((prev) => ({ ...prev, goals: prev.goals.filter((g) => g.id !== id) }))
  },

  // Mappings -----------------------------------------------------------
  saveMapping(signature: string, mapping: ColumnMapping) {
    setState((prev) => ({
      ...prev,
      savedMappings: { ...prev.savedMappings, [signature]: mapping },
    }))
  },

  // Backup / restore ---------------------------------------------------
  /** Replace the entire app state — used when restoring a JSON backup. */
  replaceAll(next: Partial<AppState>) {
    setState(() => normalizeState(next))
  },

  // Cash flow ------------------------------------------------------------
  /** Set the manually-entered account balance the cash flow forecast projects forward from. */
  setCurrentBalance(amount: number) {
    setState((prev) => ({
      ...prev,
      currentBalance: amount,
      currentBalanceUpdatedAt: new Date().toISOString(),
    }))
  },

  /** Hide (or restore) an auto-detected recurring bill/income from the cash flow forecast. */
  setRecurringDismissed(key: string, dismissed: boolean) {
    setState((prev) => ({
      ...prev,
      dismissedRecurring: dismissed
        ? prev.dismissedRecurring.includes(key)
          ? prev.dismissedRecurring
          : [...prev.dismissedRecurring, key]
        : prev.dismissedRecurring.filter((k) => k !== key),
    }))
  },
}

/** Exported for lib/backup.ts, which normalizes a parsed backup file the same way. */
export { normalizeState }

/** Convenience hook returning a stable reference to the actions object. */
export function useActions() {
  return useCallback(() => actions, [])()
}

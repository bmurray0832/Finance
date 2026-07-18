import { useCallback, useSyncExternalStore } from 'react'
import type { AppState, CategoryRule, Debt, Goal, Transaction, ColumnMapping } from '../types'
import { DEFAULT_RULES, categorize } from '../lib/categorize'
import { makeId } from '../lib/format'
import { api } from '../lib/api'

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
  budgets: {},
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
    budgets:
      parsed.budgets && typeof parsed.budgets === 'object'
        ? (parsed.budgets as Record<string, number>)
        : {},
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

/** True once the shared server state has been loaded — gates saving back to the server. */
let serverSynced = false
let saveTimer: ReturnType<typeof setTimeout> | null = null

function persistLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage may be full or unavailable; the app still works for the session.
  }
}

/** Debounced push of the whole state document to the server (last-write-wins). */
function scheduleServerSave() {
  if (!serverSynced) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    api.putState(state).catch(() => {
      // Offline or transient error: the localStorage cache still holds the
      // change, and the next successful mutation will push the latest state.
    })
  }, 600)
}

function persist() {
  persistLocal()
  scheduleServerSave()
}

function setState(updater: (prev: AppState) => AppState) {
  state = updater(state)
  persist()
  listeners.forEach((l) => l())
}

/**
 * Load the shared household state from the server after login. If the server
 * has data, it wins (it's the source of truth across devices). If the server
 * is empty but this browser has local data (e.g. the owner's pre-backend
 * data), push the local data up so nothing is lost.
 */
export async function hydrateFromServer(): Promise<void> {
  let server: Partial<AppState> = {}
  try {
    server = await api.getState()
  } catch {
    // If the fetch fails, fall back to the local cache and allow saves to retry.
    serverSynced = true
    return
  }
  const serverState = normalizeState(server)
  const serverEmpty =
    serverState.transactions.length === 0 &&
    serverState.debts.length === 0 &&
    serverState.goals.length === 0
  const localHasData =
    state.transactions.length > 0 || state.debts.length > 0 || state.goals.length > 0

  serverSynced = true
  if (serverEmpty && localHasData) {
    // Seed the server with this browser's existing data (one-time migration).
    persist()
  } else {
    state = serverState
    persistLocal()
    listeners.forEach((l) => l())
  }
}

/** Clear the local cache and stop syncing (used on logout). */
export function resetLocalState(): void {
  serverSynced = false
  if (saveTimer) clearTimeout(saveTimer)
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
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

  // Budgets --------------------------------------------------------------
  /** Set (or clear, when amount <= 0 / NaN) a category's monthly budget. */
  setBudget(category: string, amount: number) {
    setState((prev) => {
      const next = { ...prev.budgets }
      if (!amount || amount <= 0 || isNaN(amount)) {
        delete next[category]
      } else {
        next[category] = amount
      }
      return { ...prev, budgets: next }
    })
  },
}

/** Exported for lib/backup.ts, which normalizes a parsed backup file the same way. */
export { normalizeState }

/** Convenience hook returning a stable reference to the actions object. */
export function useActions() {
  return useCallback(() => actions, [])()
}

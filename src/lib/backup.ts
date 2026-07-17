import type { AppState } from '../types'

export const BACKUP_VERSION = 1

export interface BackupFile {
  app: 'finance-tracker'
  version: number
  exportedAt: string
  state: AppState
}

/** Wrap the current state in a versioned envelope for export. */
export function buildBackup(state: AppState): BackupFile {
  return {
    app: 'finance-tracker',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    state,
  }
}

/**
 * Parse a backup file's text into a well-formed AppState.
 * Accepts either the wrapped {app, version, state} envelope or a bare AppState,
 * and coerces missing collections to safe empty defaults. Throws if the file
 * doesn't look like a finance-tracker backup at all.
 */
export function parseBackup(text: string): AppState {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('The file is not valid JSON.')
  }

  const raw =
    data && typeof data === 'object' && 'state' in (data as Record<string, unknown>)
      ? (data as Record<string, unknown>).state
      : data

  if (!raw || typeof raw !== 'object') {
    throw new Error('This file does not look like a finance-tracker backup.')
  }

  const s = raw as Record<string, unknown>
  const expectedKeys = ['transactions', 'rules', 'debts', 'goals', 'savedMappings']
  if (!expectedKeys.some((k) => k in s)) {
    throw new Error('This file does not look like a finance-tracker backup.')
  }

  return {
    transactions: Array.isArray(s.transactions) ? (s.transactions as AppState['transactions']) : [],
    rules: Array.isArray(s.rules) ? (s.rules as AppState['rules']) : [],
    debts: Array.isArray(s.debts) ? (s.debts as AppState['debts']) : [],
    goals: Array.isArray(s.goals) ? (s.goals as AppState['goals']) : [],
    savedMappings:
      s.savedMappings && typeof s.savedMappings === 'object'
        ? (s.savedMappings as AppState['savedMappings'])
        : {},
  }
}

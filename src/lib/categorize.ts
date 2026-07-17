import type { CategoryRule } from '../types'
import { makeId } from './format'

export const UNCATEGORIZED = 'Uncategorized'
export const INCOME = 'Income'

/** A starter set of keyword rules covering common merchants. Users can edit/remove these. */
export const DEFAULT_RULES: CategoryRule[] = [
  ['uber', 'Transport'],
  ['lyft', 'Transport'],
  ['shell', 'Transport'],
  ['exxon', 'Transport'],
  ['chevron', 'Transport'],
  ['transit', 'Transport'],
  ['parking', 'Transport'],
  ['whole foods', 'Groceries'],
  ['trader joe', 'Groceries'],
  ['safeway', 'Groceries'],
  ['kroger', 'Groceries'],
  ['aldi', 'Groceries'],
  ['costco', 'Groceries'],
  ['grocery', 'Groceries'],
  ['starbucks', 'Dining'],
  ['mcdonald', 'Dining'],
  ['chipotle', 'Dining'],
  ['doordash', 'Dining'],
  ['grubhub', 'Dining'],
  ['restaurant', 'Dining'],
  ['netflix', 'Subscriptions'],
  ['spotify', 'Subscriptions'],
  ['hulu', 'Subscriptions'],
  ['disney', 'Subscriptions'],
  ['apple.com/bill', 'Subscriptions'],
  ['amazon', 'Shopping'],
  ['target', 'Shopping'],
  ['walmart', 'Shopping'],
  ['best buy', 'Shopping'],
  ['rent', 'Housing'],
  ['mortgage', 'Housing'],
  ['comcast', 'Utilities'],
  ['xfinity', 'Utilities'],
  ['pg&e', 'Utilities'],
  ['electric', 'Utilities'],
  ['water', 'Utilities'],
  ['at&t', 'Utilities'],
  ['verizon', 'Utilities'],
  ['t-mobile', 'Utilities'],
  ['cvs', 'Health'],
  ['walgreens', 'Health'],
  ['pharmacy', 'Health'],
  ['doctor', 'Health'],
  ['gym', 'Health'],
  ['payroll', INCOME],
  ['salary', INCOME],
  ['direct deposit', INCOME],
  ['interest paid', INCOME],
].map(([keyword, category]) => ({ id: makeId(), keyword, category }))

/**
 * Pick a category for a transaction description using keyword rules.
 * Positive-amount transactions with no matching rule default to Income;
 * everything else defaults to Uncategorized.
 */
export function categorize(description: string, amount: number, rules: CategoryRule[]): string {
  const haystack = description.toLowerCase()
  for (const rule of rules) {
    if (rule.keyword && haystack.includes(rule.keyword.toLowerCase())) {
      return rule.category
    }
  }
  return amount > 0 ? INCOME : UNCATEGORIZED
}

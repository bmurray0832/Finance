# CLAUDE.md — Handoff for the next Claude session

This file is the pickup point for anyone (human or Claude) continuing this
project. Read it first. It captures the product decisions, architecture,
conventions, current state, and a prioritized backlog.

## What this is

A **private, browser-only personal finance tracker**. It ingests bank
statement CSVs and shows a per-category spending breakdown, ranks debts for
payoff, and tracks savings goals. **There is no backend.** All data is parsed
in the browser and persisted to `localStorage`. Nothing is ever uploaded.

## Locked product decisions

These were chosen by the owner (bmurray0832). Do not reverse them without
asking:

1. **Local browser app** (React + TypeScript + Vite), not full-stack. Privacy
   is the reason — bank data never leaves the device.
2. **Flexible CSV column mapping** — works with any bank. On import the user
   maps their columns; the mapping is remembered per header signature.
3. **Keyword rules + manual override** for categorization. A starter rule set
   ships in `src/lib/categorize.ts`.
4. **Debt ranking = avalanche**: sort by interest rate (desc), then balance
   (desc). This is a requested behavior, not a preference — keep it.
5. **Hosting: Railway** (static serve of `dist/` via `serve`). See Deploy.
6. **Currency: USD.** Owner confirmed USD is fine — do not add a currency
   picker or change `format.ts` unless they ask.
7. **Cash flow forecast = auto-detect only, manual balance.** The owner chose
   *auto-detect recurring bills/income from transaction history* over a
   manual recurring-items list (and over a hybrid confirm-before-adding
   flow) — see `src/lib/recurring.ts`. They also chose a *manually-entered
   current balance* over computing it from summed transaction history. Don't
   add a manual "add recurring item" CRUD form or switch to a computed
   balance without asking first; the user can already dismiss bad detections
   from the forecast, which was judged enough control.

## Run / build / deploy

```bash
npm install
npm run dev      # dev server, http://localhost:5173
npm run build    # typecheck (tsc --noEmit) + vite build -> dist/
npm run start    # prod: serve -s dist -l ${PORT:-3000}  (what Railway runs)
```

- **Railway**: `railway.json` uses Nixpacks → `npm run build` → `npm run start`.
  Deploy branch should be `main`. No env vars, no DB, no secrets.
- Routing uses **HashRouter** on purpose, so no server rewrite rules are
  needed on any static host. URLs look like `/#/debts`.
- `serve` is a runtime dep (in `dependencies`, not `devDependencies`) so it
  survives dependency pruning at runtime.

## Architecture / file map

```
src/
  main.tsx            Router (HashRouter) + route table
  types.ts            All domain types (Transaction, Debt, Goal, CategoryRule, ColumnMapping)
  index.css           Design system (dark theme, CSS variables). No CSS framework.
  store/useStore.ts   Single localStorage-backed store via useSyncExternalStore.
                      Exposes `useStore()` (read) and `actions` (mutations).
  lib/
    csv.ts            PapaParse wrapper, header signature, mapping guess,
                      rows -> Transactions, number/date parsing, dedupe.
    categorize.ts     DEFAULT_RULES + categorize(); UNCATEGORIZED / INCOME consts.
    analytics.ts      Month/quarter/year period filtering (PeriodType/periodKey/
                      availablePeriods/filterByPeriod/periodLabel), category
                      breakdown, totals, chart palette. monthKey/monthLabel are
                      still here as internal helpers periodKey/periodLabel build
                      on for the 'month' granularity.
    recurring.ts      detectRecurring(): groups transactions by normalized
                      description, finds ones repeating on a consistent
                      interval (weekly/biweekly/monthly/quarterly/annual) and
                      amount (>=3 occurrences), returns RecurringPattern[].
    cashflow.ts       buildForecast() projects patterns forward to a horizon,
                      runningBalance() walks a starting balance through the
                      events, computeSafeToSpend() derives the headline
                      "safe to spend" figure (the lowest projected balance
                      before the next detected income event).
    format.ts         Currency/percent/date formatting + makeId().
    backup.ts         JSON backup envelope: buildBackup() / parseBackup().
  components/
    Layout.tsx        Sidebar nav + <Outlet/>.
    ImportModal.tsx   The whole import flow: file -> map columns -> preview -> commit.
    PeriodFilter.tsx  Month/Quarter/Year segmented toggle + period dropdown;
                      shared by Dashboard and Transactions.
  pages/
    Dashboard.tsx     Stats + donut chart (recharts) + category table + period filter.
    Transactions.tsx  Search, period + category filters, inline category
                      override (incl. "New category…" to create one), delete, clear.
    Debts.tsx         Avalanche ranking, add/edit/delete, "focus first" banner.
    Goals.tsx         Progress cards, contribute, add/edit/delete.
    CashFlow.tsx      Current balance (manual, edited via prompt()), safe-to-spend
                      + lowest-balance stats, upcoming events table, detected
                      recurring bills/income with dismiss/restore.
    Rules.tsx         Manage keyword rules; re-apply to all.
    Settings.tsx      JSON export/import (backup & restore) + data summary.
sample-statement.csv  Demo data for trying the import flow.
```

## Key conventions & invariants (don't break these)

- **Amount sign**: `Transaction.amount` is signed. **Negative = money out
  (expense), positive = money in (income).** All spend math relies on this.
  CSV import normalizes to it (single signed column, or `credit - debit`, with
  an `expensesArePositive` flip for banks that list expenses as positive).
- **Spending breakdown** (`analytics.categoryBreakdown`) counts only negative
  amounts and **excludes the `Income` category**. Don't let income pollute
  category spend.
- **Manual category overrides are sticky**: `updateTransactionCategory` sets
  `categoryLocked: true`, and `reapplyRules()` skips locked transactions.
  Preserve this — re-running rules must never clobber a user's manual choice.
- **Persistence**: single key `finance-tracker-state-v1` in `localStorage`.
  If you change the shape of `AppState` in a breaking way, bump the key and add
  a migration in `store/useStore.ts` (`loadState`). Additive fields (new
  optional-with-default properties like `currentBalance` or
  `dismissedRecurring`) don't need a bump — `normalizeState()` defaults
  anything missing, so older localStorage/backups still load fine.
- **Recurring detection is re-run on every render** from `transactions` via
  `useMemo` in `CashFlow.tsx` — nothing about detected patterns is persisted
  except the user's dismiss list (`dismissedRecurring: string[]`, keyed by the
  pattern's normalized-description `key`). If you change the normalization
  logic in `recurring.ts`, existing dismissals may stop matching and
  previously-dismissed items can reappear — that's an acceptable tradeoff for
  keeping the store simple, but worth knowing.
- **Store pattern**: mutations go through `actions.*` and call `setState`,
  which persists + notifies. Components read via `useStore()`. There is no
  Redux/Zustand — keep it this dependency-light unless there's a real need.
- **IDs**: `makeId()` in `format.ts`. Fine for a local app.

## Current status — DONE

- CSV import with flexible mapping, guess-from-headers, remembered mappings,
  duplicate detection, single-amount and debit/credit modes.
- Dashboard: income/expense/net/count stats, donut chart, category table with
  share %, month/quarter/year filter.
- Transactions: search, month/quarter/year filter, category filter, inline
  category override (with "New category…" to create a new one on the fly),
  a "Showing N of M" count + Clear filters, delete, clear.
- Debts: avalanche ranking, weighted APR, monthly interest, focus banner, CRUD.
- Goals: progress bars, contributions, CRUD, "reached" state.
- Rules: CRUD + re-apply, datalist of existing categories.
- **Month/quarter/year period filter** (`src/lib/analytics.ts`'s `PeriodType`
  + `PeriodFilter.tsx`): a segmented Month/Quarter/Year toggle plus a period
  dropdown, shared by Dashboard and Transactions. Switching granularity resets
  the selected period to "All time" since the key formats differ
  (`2026-07` / `2026-Q3` / `2026`).
- **Cash Flow page** (`src/pages/CashFlow.tsx`, route `/cashflow`): detects
  recurring bills/income from transaction history (`lib/recurring.ts`,
  requires ≥3 occurrences on a consistent interval — weekly/biweekly/
  monthly/quarterly/annual — and a consistent amount, ~35% tolerance on
  both), projects them forward from a manually-entered current balance
  (`lib/cashflow.ts`), and surfaces a "safe to spend now" figure = the lowest
  the balance is projected to dip before the next detected income event (or
  over the whole horizon if no income pattern was found). Users can dismiss
  bad detections (persisted in `dismissedRecurring`) and restore them later.
  Horizon is a 30/60/90-day toggle.
- **Settings: JSON export/import** (`src/pages/Settings.tsx` + `lib/backup.ts`,
  route `/settings`). Export wraps state in a versioned
  `{ app: 'finance-tracker', version, exportedAt, state }` envelope and
  downloads it as a file. Restore-from-file validates the envelope, shows a
  counts + confirm dialog (destructive — full replace), then calls
  `actions.replaceAll()`, which runs the same `normalizeState()` used by
  `loadState()` — so an older backup missing newer fields (like
  `currentBalance`/`dismissedRecurring`) still restores cleanly instead of
  wiping them. Also shows a per-browser data summary table. Round-trip
  verified.
- Railway deploy config; verified `npm run build` and `npm run start`.
- End-to-end verified in headless Chromium: import, ranking, goal progress;
  the export → clear → restore → reload round-trip for backups; recurring
  detection against a synthetic 5-month dataset (correctly found a monthly
  rent, monthly subscription, and biweekly paycheck, correctly rejected an
  irregular 3-visit restaurant group); balance entry, dismiss/restore/
  persist-across-reload; and the month/quarter/year filter on both Dashboard
  and Transactions.

## Known limitations / deferred decisions

- **Currency is USD by design** — hardcoded in `src/lib/format.ts`
  (`Intl.NumberFormat ... currency: 'USD'`). Owner confirmed USD is fine, so
  this is a settled decision, not a gap. If they ever change their mind,
  `format.ts` is the single place to start (persist the choice in the store).
- **Data portability is manual**: JSON export/import exists on the Settings
  page (backup/restore, replaces all on restore). There is still no *automatic*
  cross-device sync — that would need a backend, which is deliberately out of
  scope.
- **No tests** yet (only ad-hoc Playwright smoke runs during development).
- **No monthly trend / time series** — only per-period breakdown (the new
  month/quarter/year filter changes granularity, but still shows one period
  at a time, not a chart across periods).
- Bundle is ~597 kB (recharts). Fine for a local app; code-split if it grows.
- Date parsing assumes **MM/DD/YYYY** for ambiguous slash dates (US bank
  default). Revisit if the owner uses a DD/MM bank.
- **Recurring detection needs ≥3 matching occurrences**, so a bill only
  imported once or twice (or a brand-new subscription) won't show up in the
  Cash Flow forecast yet — by design, to avoid false positives from one-off
  purchases. The amount/interval tolerance (~35%) is a heuristic; very
  variable bills (e.g. a utility bill that swings 2x seasonally) may fail to
  match or may match with an inaccurate average amount. There's no manual
  override for the projected amount/date of a pattern — only dismiss/restore
  the whole pattern (see locked decision #6).
- **Cash flow "safe to spend"** assumes the *only* upcoming money movements
  are the detected recurring patterns — one-off/irregular spending between
  now and the next paycheck isn't accounted for, so treat it as a floor, not
  a guarantee.

## Suggested backlog (roughly prioritized)

1. **Monthly trend chart** on the Dashboard (spend over time).
2. **Budgets per category** with over/under indicators.
3. **Bulk re-categorize** from the Transactions view (e.g. "create a rule from
   this merchant").
4. **Tests** — unit tests for `csv.ts` parsing/mapping,
   `analytics.categoryBreakdown`, and `backup.parseBackup`; they're pure and
   easy to cover.
5. **Merge-on-restore option** — restore currently replaces all; a "merge"
   mode (dedupe by id) could be offered alongside replace.

_Not planned: currency picker — owner confirmed USD is fine (see Locked
product decisions)._

_Done since first handoff: JSON export/import backup (Settings page)._

## Git / workflow notes

- `main` is the default + canonical branch and what Railway deploys.
- The original dev branch `claude/personal-finance-tracker-9yq4xj` is now
  redundant (identical to `main`) and safe to delete.
- Commit style: clear subject + body; co-author trailer is added by the
  harness. Don't put model identifiers in commits/PRs.

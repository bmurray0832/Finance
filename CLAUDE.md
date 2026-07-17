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
    analytics.ts      Month filtering, category breakdown, totals, chart palette.
    format.ts         Currency/percent/date formatting + makeId().
    backup.ts         JSON backup envelope: buildBackup() / parseBackup().
  components/
    Layout.tsx        Sidebar nav + <Outlet/>.
    ImportModal.tsx   The whole import flow: file -> map columns -> preview -> commit.
  pages/
    Dashboard.tsx     Stats + donut chart (recharts) + category table + month filter.
    Transactions.tsx  Search, month filter, inline category override, delete, clear.
    Debts.tsx         Avalanche ranking, add/edit/delete, "focus first" banner.
    Goals.tsx         Progress cards, contribute, add/edit/delete.
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
  a migration in `store/useStore.ts` (`loadState`).
- **Store pattern**: mutations go through `actions.*` and call `setState`,
  which persists + notifies. Components read via `useStore()`. There is no
  Redux/Zustand — keep it this dependency-light unless there's a real need.
- **IDs**: `makeId()` in `format.ts`. Fine for a local app.

## Current status — DONE

- CSV import with flexible mapping, guess-from-headers, remembered mappings,
  duplicate detection, single-amount and debit/credit modes.
- Dashboard: income/expense/net/count stats, donut chart, category table with
  share %, month filter.
- Transactions: search, month filter, inline category override, delete, clear.
- Debts: avalanche ranking, weighted APR, monthly interest, focus banner, CRUD.
- Goals: progress bars, contributions, CRUD, "reached" state.
- Rules: CRUD + re-apply, datalist of existing categories.
- Settings: JSON export (versioned envelope) + restore-from-file (replaces all,
  with confirmation), plus a per-browser data summary. Round-trip verified.
- Railway deploy config; verified `npm run build` and `npm run start`.
- End-to-end verified in headless Chromium (import, ranking, goal progress).

## Known limitations / deferred decisions

- **Currency is hardcoded to USD** in `src/lib/format.ts`
  (`Intl.NumberFormat ... currency: 'USD'`). Owner was asked; not yet changed.
  If they want GBP/EUR or a picker, this is the single place to start (persist
  the choice in the store).
- **Data portability is manual**: JSON export/import exists on the Settings
  page (backup/restore, replaces all on restore). There is still no *automatic*
  cross-device sync — that would need a backend, which is deliberately out of
  scope.
- **No tests** yet (only ad-hoc Playwright smoke runs during development).
- **No monthly trend / time series** — only per-period breakdown.
- Bundle is ~580 kB (recharts). Fine for a local app; code-split if it grows.
- Date parsing assumes **MM/DD/YYYY** for ambiguous slash dates (US bank
  default). Revisit if the owner uses a DD/MM bank.

## Suggested backlog (roughly prioritized)

1. **Currency setting** — store `currency` in `AppState`, thread through
   `format.ts`. Ask the owner which currency first.
2. **Monthly trend chart** on the Dashboard (spend over time).
3. **Budgets per category** with over/under indicators.
4. **Bulk re-categorize** from the Transactions view (e.g. "create a rule from
   this merchant").
5. **Tests** — unit tests for `csv.ts` parsing/mapping,
   `analytics.categoryBreakdown`, and `backup.parseBackup`; they're pure and
   easy to cover.
6. **Merge-on-restore option** — restore currently replaces all; a "merge"
   mode (dedupe by id) could be offered alongside replace.

_Done since first handoff: JSON export/import backup (Settings page)._

## Git / workflow notes

- `main` is the canonical branch and what Railway deploys.
- The original dev branch `claude/personal-finance-tracker-9yq4xj` exists and
  is identical to `main` at handoff time; it can be deleted once the owner sets
  `main` as the GitHub default branch (a repo Setting — not changeable via the
  tools available in-session).
- Commit style: clear subject + body; co-author trailer is added by the
  harness. Don't put model identifiers in commits/PRs.

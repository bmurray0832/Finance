# CLAUDE.md — Handoff for the next Claude session

This file is the pickup point for anyone (human or Claude) continuing this
project. Read it first. It captures the product decisions, architecture,
conventions, current state, and a prioritized backlog.

## What this is

A **private household personal finance tracker**. It ingests bank statement
CSVs and shows a per-category spending breakdown, ranks debts for payoff,
tracks savings goals and budgets, and forecasts cash flow. Data is stored on a
small **Node/Express + Postgres backend** behind a shared login, so both
spouses see and edit the same data from their own devices. The browser keeps a
`localStorage` cache of the shared state for fast loads and offline viewing.

> **NOTE — the original "browser-only, no backend" design was intentionally
> reversed** at the owner's request (they needed the owner's wife to see the
> same uploaded transactions from another device). The old locked decision #1
> ("local browser app, bank data never leaves the device") no longer holds.
> Everything else about the app is unchanged.

## Locked product decisions

These were chosen by the owner (bmurray0832). Do not reverse them without
asking:

1. **Shared-account full-stack app** (React + TS + Vite frontend, Node/Express
   + Postgres backend). Auth is a **single shared household login** (one
   email+password both spouses use), seeded from env — **no public sign-up**.
   (This replaced the original local-only design; see note above.)
2. **Flexible CSV column mapping** — works with any bank. On import the user
   maps their columns; the mapping is remembered per header signature.
3. **Keyword rules + manual override** for categorization. A starter rule set
   ships in `src/lib/categorize.ts`.
4. **Debt ranking = avalanche**: sort by interest rate (desc), then balance
   (desc). This is a requested behavior, not a preference — keep it.
5. **Hosting: Railway** (Node server serves `dist/` + API; Railway Postgres).
   See Deploy.
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
# Dev: run the backend + the Vite dev server (two terminals).
AUTH_EMAIL=you@x.com AUTH_PASSWORD=devpass JWT_SECRET=dev npm run dev:server  # :3000
npm run dev          # :5173, proxies /api -> :3000
npm run build        # typecheck (tsc --noEmit) + vite build -> dist/
npm run start        # prod: node server/index.js  (serves dist/ + API on $PORT)
```

- **Backend** (`server/index.js` + `server/store.js`): Express serving the SPA
  and a small API — `/api/login`, `/api/logout`, `/api/me`,
  `GET/PUT /api/state`. Storage is Postgres when `DATABASE_URL` is set, else a
  local JSON file (`server/.data.json`) for dev. State is a single shared
  document (one row); auth is one shared user seeded from `AUTH_EMAIL`/
  `AUTH_PASSWORD` (bcrypt-hashed). JWT in an httpOnly cookie (`ft_token`),
  signed with `JWT_SECRET`; login is rate-limited (10 fails/15 min/IP).
- **Env vars** (see `.env.example`): `AUTH_EMAIL`, `AUTH_PASSWORD`,
  `JWT_SECRET` (required in prod), `DATABASE_URL` (from Railway Postgres),
  optional `DATABASE_SSL=true`, `NODE_ENV=production`. `PORT` is provided by
  Railway. Rotating `JWT_SECRET` logs everyone out. Changing `AUTH_PASSWORD` +
  redeploy rotates the shared password (the seed upserts the user's hash).
- **Railway**: `railway.json` uses Nixpacks → `npm run build` → `npm run start`.
  Add the Postgres plugin and set the env vars above. Deploy branch = `main`.
- Routing uses **HashRouter**, so no server rewrite rules are needed; the
  Express `*` fallback serves `index.html` anyway.
- **No `serve` dependency anymore** — the Express server replaced it.

## Architecture / file map

```
server/
  index.js            Express: serves dist/ + API (login/logout/me/state),
                      JWT-cookie auth, bcrypt, login throttle.
  store.js            Storage layer: Postgres (DATABASE_URL) or JSON file
                      fallback; init() seeds the shared user + empty state row.
src/
  main.tsx            <AuthGate> wrapping Router (HashRouter) + route table
  types.ts            All domain types (Transaction, Debt, Goal, CategoryRule, ColumnMapping)
  index.css           Design system (dark theme, CSS variables). No CSS framework.
  store/useStore.ts   Shared store via useSyncExternalStore. Loads state from the
                      server (hydrateFromServer) after login, saves changes back
                      (debounced PUT), keeps a localStorage cache. Exposes
                      `useStore()` (read), `actions` (mutations),
                      `hydrateFromServer`, `resetLocalState`, `normalizeState`.
  lib/
    api.ts            fetch client for the backend (me/login/logout/get+putState).
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
    AuthGate.tsx      Checks /api/me; shows <Login> or hydrates + renders the app.
    Login.tsx         Full-screen shared-account sign-in form.
    Layout.tsx        Sidebar nav + Log out + <Outlet/>.
    ImportModal.tsx   The whole import flow: file -> map columns -> preview -> commit.
    PeriodFilter.tsx  Month/Quarter/Year segmented toggle + period dropdown;
                      shared by Dashboard and Transactions.
  pages/
    Dashboard.tsx     Stats + donut chart (recharts) + category table + period
                      filter. Clicking a category (table row or pie slice) opens
                      a CategoryDrillDown modal listing that category's money-out
                      transactions within the selected period.
    Transactions.tsx  Search, period + category filters, inline category
                      override (incl. "New category…" to create one), delete, clear.
    Debts.tsx         Avalanche ranking, add/edit/delete, "focus first" banner.
    Goals.tsx         Progress cards, contribute, add/edit/delete.
    CashFlow.tsx      Current balance (manual, edited via prompt()), safe-to-spend
                      + lowest-balance stats, upcoming events table, detected
                      recurring bills/income with dismiss/restore.
    Budgets.tsx       Set a monthly budget per category; shows each category's
                      spend for the latest month with a stoplight delta.
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
- **Persistence**: the **server is the source of truth** — the whole `AppState`
  is stored as one shared JSON document (`app_state` row, or `state` in the dev
  JSON file). `localStorage` (`finance-tracker-state-v1`) is now just a **cache**
  for fast loads/offline; `hydrateFromServer()` overwrites it from the server on
  login (unless the server is empty and the browser has data, in which case the
  local data is pushed up — the one-time migration). Every mutation persists to
  the cache immediately and schedules a debounced `PUT /api/state`. Sync is
  **last-write-wins** across devices. If you change `AppState`'s shape, keep it
  additive — `normalizeState()` defaults anything missing, so old
  cache/backups/server docs still load; a breaking change needs a real migration
  on the stored document, not just a localStorage key bump.
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
  share %, month/quarter/year filter, and click-to-drill-down (category row or
  pie slice → modal of that category's transactions for the selected period).
  When budgets are set, the breakdown swaps its Share/# columns for
  Budget/vs-budget with stoplight-colored deltas.
- Budgets: `src/pages/Budgets.tsx` (route `/budgets`) sets a monthly budget per
  category; the Dashboard reflects planned-vs-actual with stoplight colors
  (green at/under, amber ≤10% over, red >10% over), scaling monthly budgets to
  the number of months in the selected period. Persisted as
  `budgets: Record<category, number>` in the store (additive, defaulted by
  `normalizeState`, included in JSON backups). No emoji anywhere in the UI.
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
- **Backend + shared login** (`server/`): Node/Express + Postgres (JSON-file
  fallback in dev). Shared household account seeded from env, bcrypt + JWT
  httpOnly cookie, login rate-limit, no public sign-up. Store now server-backed
  (localStorage = cache); first login pushes any pre-backend browser data up.
  Verified end-to-end in headless Chromium: unauth → login screen, wrong
  password error, correct login → app, import → state persisted to server,
  reload stays logged in with data from server, logout, and the one-time
  local→server migration.
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
- **Cross-device sync is now built in** (shared server account). Sync is
  whole-document **last-write-wins**: if both people save different changes
  within the ~600ms debounce window, the later PUT wins and the earlier change
  is lost. Fine for two occasional users; if it becomes a problem, move to
  field-level updates or add updated_at conflict checks. JSON export/import on
  Settings still exists as an offline backup.
- **Auth is a single shared login** (per locked decision #1). There's no
  per-user identity, so you can't tell who changed what. Individual logins
  (still one shared dataset) would be a small extension if wanted.
- **Secrets live in env vars** (`AUTH_PASSWORD`, `JWT_SECRET`). There's no
  in-app password change or password-reset flow — rotate via env + redeploy.
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
2. _(done)_ ~~Budgets per category with over/under indicators.~~ Shipped:
   `src/pages/Budgets.tsx` + `budgets: Record<string, number>` in the store +
   `budgetStatus`/`budgetLevelClass`/`distinctMonthCount` in analytics.ts.
   Dashboard breakdown shows planned-vs-actual with stoplight colors (green =
   at/under, amber = ≤10% over, red = >10% over), monthly budgets scaled by the
   number of months in the selected period.
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

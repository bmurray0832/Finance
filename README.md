# Finance Tracker

A private, **browser-only** personal finance tracker. Import your bank
statement CSVs to get a per-category spending breakdown, rank your debts for
fastest payoff, and track savings goals.

Everything runs locally in your browser — your statements are parsed on your
own machine and stored in the browser's `localStorage`. **Nothing is ever
uploaded to a server.**

## Features

- **Category breakdown** — import any bank's CSV and see spending grouped by
  category, with a donut chart, per-category totals, share of spend, and a
  month/quarter/year filter. Click any category (row or pie slice) to drill
  into the transactions behind it for the selected period.
- **Transactions** — search, filter by month/quarter/year, and override any
  transaction's category. Manual overrides are protected from
  re-categorization.
- **Debt payoff** — track loans and credit cards, automatically ranked by
  interest rate (then balance) using the **avalanche method** to minimize
  interest paid. Shows weighted APR and monthly interest cost.
- **Savings goals** — set targets, log contributions, and watch progress
  bars fill up.
- **Budgets** — set a monthly budget per category; the Dashboard shows planned
  vs actual with stoplight colors (green at/under, amber up to 10% over, red
  more than 10% over) and how far off you are.
- **Cash flow** — auto-detects recurring bills and income from your
  transaction history (rent, subscriptions, paychecks — anything that repeats
  on a consistent schedule and amount) and projects them forward from your
  current balance, so you can see how much you can safely spend before your
  next paycheck and whether any upcoming stretch is tight.
- **Category rules** — keyword rules (e.g. `netflix` → `Subscriptions`)
  auto-categorize transactions. A starter set is included; add your own.
- **Settings** — export a full JSON backup or restore one, for moving your
  data to another browser or device.

## Getting started

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
```

To build for production:

```bash
npm run build
npm run preview
```

## Importing a statement

1. Click **Import CSV** on the Dashboard or Transactions page.
2. Drop in your bank's CSV export.
3. Map the columns (Date, Description, and either a single signed **Amount**
   column or separate **Debit/Credit** columns). The app guesses the mapping
   from your headers and remembers it for that bank next time.
4. Review the preview and import.

A `sample-statement.csv` is included so you can try it immediately.

### CSV format notes

- Works with any bank via flexible column mapping.
- Amounts may be a single signed column (negative = money out) or separate
  debit/credit columns. If your bank lists expenses as positive numbers, tick
  **"Positive numbers are expenses."**
- Dates in `YYYY-MM-DD`, `MM/DD/YYYY`, and `DD/MM/YYYY` are handled.

## Tech

React + TypeScript + Vite, PapaParse for CSV parsing, Recharts for the chart,
and `localStorage` for persistence. No backend.

## Privacy

All data lives in your browser. Clearing your browser storage (or using the
**Clear all** button) removes it. There are no accounts, no network calls, and
no telemetry.

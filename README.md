# Finance Tracker

A private personal finance tracker for a household. Import your bank statement
CSVs to get a per-category spending breakdown, rank your debts for fastest
payoff, track savings goals and budgets, and forecast cash flow.

Data is synced to a **private, password-protected household account** so both
people can see and edit the same numbers from their own devices. It's served by
a small Node/Express + Postgres backend; the browser keeps a local cache for
fast loads and offline viewing. There is **no public sign-up** — only the
seeded household account(s) can log in.

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
  more than 10% over) and how far off you are. Set your paycheck + payday to
  project monthly income (paycheck × the number of that weekday in the month, so
  4 or 5) and see how much is left to allocate.
- **Cash flow** — auto-detects recurring bills and income from your
  transaction history (rent, subscriptions, paychecks — anything that repeats
  on a consistent schedule and amount) and projects them forward from your
  current balance, so you can see how much you can safely spend before your
  next paycheck and whether any upcoming stretch is tight.
- **Category rules** — keyword rules (e.g. `netflix` → `Subscriptions`)
  auto-categorize transactions. A starter set is included; add your own.
- **Settings** — export a full JSON backup or restore one, for moving your
  data to another browser or device.

## Getting started (local dev)

```bash
npm install

# 1. Start the backend (serves the API; falls back to a local JSON file when
#    DATABASE_URL is unset, so no Postgres is needed for dev).
AUTH_EMAIL=you@example.com AUTH_PASSWORD=devpass JWT_SECRET=dev-secret npm run dev:server

# 2. In another terminal, start the Vite dev server (proxies /api to :3000).
npm run dev      # http://localhost:5173
```

Log in with the `AUTH_EMAIL` / `AUTH_PASSWORD` you set above.

To build and run the production server (serves the built app + API on one port):

```bash
npm run build
AUTH_EMAIL=... AUTH_PASSWORD=... JWT_SECRET=... npm run start   # http://localhost:3000
```

See `.env.example` for all configuration.

## Deploy (Railway)

1. Add a **Postgres** database to your Railway project (provides `DATABASE_URL`).
2. On the app service, set variables: `AUTH_EMAIL`, `AUTH_PASSWORD`,
   `JWT_SECRET` (a long random string), and `NODE_ENV=production`. Set
   `DATABASE_SSL=true` if your Postgres requires SSL.
3. Deploy from `main`. Nixpacks runs `npm run build` then `npm run start`
   (`node server/index.js`), which serves the app and API on Railway's `$PORT`.
4. Generate a domain and share it with your household. Everyone logs in with the
   same credentials and sees the same data.

The first time you log in on the browser that already had local (pre-backend)
data, that data is pushed up to the server automatically so nothing is lost.

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

Frontend: React + TypeScript + Vite, PapaParse for CSV parsing, Recharts for
charts. Backend: Node/Express with Postgres (JSON-file fallback for dev), auth
via bcrypt-hashed passwords and a JWT in an httpOnly cookie. The browser keeps a
`localStorage` cache of the shared state for fast loads.

## Privacy & access

Your data lives in your own Postgres database behind a login you control — it is
not shared with anyone who doesn't have the household credentials, and there is
no public registration. Passwords are bcrypt-hashed; sessions use a signed,
httpOnly cookie over HTTPS. Rotating `JWT_SECRET` logs everyone out. There is no
third-party analytics or telemetry.

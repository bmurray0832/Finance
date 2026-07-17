# Ideas: expanding the financial suite + a Giving module

_Source of inspiration: **StewardFlow** by Barnabas Software — a church
**stewardship / giving** management platform (the shared link pointed at its
`/admin/billing` module, i.e. subscriptions + giving administration). The live
demo wasn't reachable from the build environment (network policy blocked the
host), so these ideas are drawn from the stewardship/giving-platform category
as a whole — Tithely, Planning Center Giving, Pushpay, ChurchTrac, Aplos,
Subsplash — and then **adapted to this app's constraints**: a private,
browser-only, no-backend personal finance tracker. Everything below stays
local; nothing here requires uploading data anywhere._

Each idea notes the **existing modules it would reuse** so the next session can
see it's grounded in the current architecture, not a rewrite.

Legend: ⭐ = high-leverage / low-lift given what's already built ·
🔒 = must respect a locked product decision (see `CLAUDE.md`).

---

## Theme 1 — A "Giving" area (the headline expansion)

The app already tracks signed transactions and categorizes them. "Giving" is
just outgoing money with meaning attached, so most of this is a **new view over
existing data** plus a couple of small store additions — very much in the spirit
of the current design.

1. ⭐ **Giving page / route (`/giving`)** — a dedicated view that surfaces all
   transactions in giving-flavored categories (Tithe, Offering, Charity,
   Donations). Mirror the structure of `Dashboard.tsx`: total given this
   period, count, trend, and a breakdown. Reuses `analytics.ts`
   (period filtering + breakdown) and `categorize.ts`. Add "Tithe/Giving" to
   `DEFAULT_RULES` so it auto-tags out of the box.

2. ⭐ **Tithe / giving goal (% of income)** — set a target giving rate (e.g.
   10% of income) and track giving-vs-income YTD with an "on track / behind by
   $X" indicator. This is the generosity analogue of the existing savings
   `Goals` — reuse the Goals card/progress UI and `analytics` income totals.

3. **Funds / designations** — let a giving transaction carry a *fund* tag
   (Tithe, Missions, Building, Benevolence, General). Adds one optional field to
   `Transaction` (additive — no store version bump per the `normalizeState`
   convention) and a fund filter on the Giving page. Directly mirrors the
   "funds/designations" every church giving platform offers.

4. **Pledges / giving commitments** — pledge $X to a fund or campaign over a
   date range and track fulfillment progress against actual giving. It's a
   `Goal` pointed *outward* (contributions come from matched transactions
   instead of manual "contribute" clicks). Reuse the Goals CRUD + progress bar.

5. ⭐ **Recurring giving detection** — `recurring.ts` already finds repeating
   debits; surface detected recurring donations on the Giving page and roll them
   into an **annual giving forecast** ("on pace to give ~$4,800 this year").
   Almost free — it's the same detector the Cash Flow page uses.

6. ⭐ **Year-end giving statement** — one-click **printable / exportable**
   annual giving summary (by fund, by recipient, by month) for tax time. Pure
   client-side: build the totals with `analytics.ts`, render with print CSS,
   and/or reuse the CSV path. This is the single most-requested feature in every
   giving platform and fits "nothing leaves the device" perfectly.

7. **Recipients / organizations** — track *who* you give to (church, specific
   charities) as a light tag, and show a per-recipient breakdown. Enables a
   "you supported 6 organizations this year" statement line.

8. **Generosity stat on the Dashboard** — a "Given this period" tile plus a
   giving-as-%-of-income figure, so generosity is visible next to
   income/expense/net. Reuses the existing stat-tile layout.

9. **Giving streak / trend** — consecutive months with giving, and a small
   giving-over-time sparkline. Encourages consistency; reuses period bucketing.

---

## Theme 2 — Subscriptions & bills (the `/admin/billing` angle)

The shared URL was the **billing** module. For a personal tracker, the parallel
is "what recurring charges am I on the hook for?" — high value and, again,
mostly a new lens on the recurring detector that already exists.

10. ⭐ **Subscription tracker** — a view listing detected recurring subscriptions
    (Netflix, Spotify, SaaS) with monthly + annualized cost and next expected
    charge date. Reuses `recurring.ts` filtered to non-bill merchants.

11. **Price-increase / "creep" flags** — when a recurring charge's amount rises
    vs. its historical average, flag it ("Spotify went $9.99 → $11.99"). The
    detector already computes per-pattern averages; this compares recent vs.
    older occurrences.

12. **"Total subscription burden" headline** — one number: $X/month, $Y/year
    across all detected subscriptions, with a ranked list of the biggest ones to
    consider cancelling. A concrete money-saving deliverable.

13. **Renewal / bill calendar** — a month grid of upcoming detected recurring
    bills and income (extends the Cash Flow forecast's event list into a
    calendar layout). Reuses `cashflow.buildForecast()`.

---

## Theme 3 — Reporting & statements (stewardship = good records)

Stewardship platforms live and die on clean statements. These are all
local-only, print/CSV-based, and reuse `analytics.ts` + `format.ts`.

14. ⭐ **Printable period report** — a clean, print-CSS monthly/quarterly/annual
    summary (income, expenses by category, net, giving, savings) suitable for
    "save as PDF." No new deps.

15. **CSV export of transactions** — the app can export JSON backups but not a
    plain transactions CSV; add a CSV export (round-trips with the existing
    `csv.ts` importer). Useful for spreadsheets and accountants.

16. **Tax-prep summary** — tag categories as tax-relevant (charitable giving,
    medical, business) and produce a one-screen deductible-items summary +
    export at tax time. Builds straight on funds/recipients (ideas 3, 7).

---

## Theme 4 — Broader financial suite (rounds out the "suite")

Adjacent modules a "financial suite" is expected to have; several overlap the
existing `CLAUDE.md` backlog and are re-listed here with the giving lens.

17. ⭐ **Monthly trend chart** (already backlog #1) — spend/income/giving over
    time on the Dashboard, not just one period at a time. Recharts is already a
    dependency.

18. ⭐ **Budgets per category** (already backlog #2) — set a monthly cap per
    category with over/under indicators; naturally extends to a **"give / save /
    live" split** (e.g. 10/20/70) — a stewardship-native budgeting frame.

19. **Net worth view** — combine `Debts` (liabilities) with a simple
    assets/accounts list to show net worth and its trend. Reuses the Debts data
    model for the liability side.

20. **Accounts / sources** — optional per-transaction account tag (Checking,
    Savings, Credit Card) with per-account filtering. Additive field on
    `Transaction`; unlocks multi-account cash-flow accuracy.

21. **Income breakdown page** — a mirror of the spending breakdown for income
    sources (salary, side income, gifts). Reuses `categoryBreakdown` logic with
    the sign flipped.

22. **Savings-rate metric** — headline "you saved X% of income this period,"
    the companion to the giving-rate metric (idea 2).

23. **Bulk re-categorize / "make a rule from this merchant"** (already backlog
    #3) — from Transactions, turn a merchant into a `CategoryRule` in one click;
    pairs perfectly with giving auto-tagging (idea 1).

---

## Theme 5 — Foundation / polish (make the above safe to build)

24. **Tests** (already backlog #4) — unit-cover the pure libs before layering
    giving math on top: `csv.ts`, `analytics.categoryBreakdown`,
    `recurring.detectRecurring`, `backup.parseBackup`, and any new giving totals.

25. **Merge-on-restore option** (already backlog #5) — a dedupe-by-id merge mode
    alongside the current replace-all restore; lowers the risk of importing
    giving history from another device.

---

## Suggested first slice (highest value, lowest lift)

If picking up only a few, these reuse the most existing code for the most
visible "giving suite" payoff:

1. **Giving page** (idea 1) + **giving auto-tag rule** — a new lens on data
   that's already there.
2. **Year-end giving statement** (idea 6) — the flagship giving-platform feature,
   and a natural fit for local-only/print export.
3. **Tithe / giving goal** (idea 2) + **Dashboard generosity tile** (idea 8) —
   makes generosity a tracked, first-class number.
4. **Subscription tracker** (idea 10) — turns the existing recurring detector
   into a money-saving billing view (the `/admin/billing` inspiration).

## Notes on locked product decisions (don't trip over these)

- 🔒 **No backend / privacy** — every idea above is computed in the browser and
  persisted to `localStorage`; statements/exports are generated client-side and
  downloaded. No online-giving payment processing (that would need a backend and
  is out of scope for a *personal* tracker).
- 🔒 **USD only** — giving amounts follow the same `format.ts`; don't add a
  currency picker.
- 🔒 **Additive store fields are fine** — fund/recipient/account tags are
  optional fields defaulted by `normalizeState()`, so no key bump is needed
  (see the persistence convention in `CLAUDE.md`).
- 🔒 **Recurring = auto-detect only** — the giving/subscription forecasts should
  keep reusing `recurring.ts` detection rather than introducing a manual
  recurring-items CRUD, consistent with locked decision #7.

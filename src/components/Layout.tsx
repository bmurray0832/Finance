import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/transactions', label: 'Transactions' },
  { to: '/debts', label: 'Debt Payoff' },
  { to: '/goals', label: 'Savings Goals' },
  { to: '/cashflow', label: 'Cash Flow' },
  { to: '/budgets', label: 'Budgets' },
  { to: '/rules', label: 'Category Rules' },
  { to: '/settings', label: 'Settings' },
]

export default function Layout() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-badge">$</span>
          <span>Finance</span>
        </div>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
          >
            {l.label}
          </NavLink>
        ))}
        <div className="sidebar-footer">
          All data stays in your browser. Nothing is uploaded.
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}

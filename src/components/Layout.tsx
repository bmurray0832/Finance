import { NavLink, Outlet } from 'react-router-dom'
import { api } from '../lib/api'
import { resetLocalState } from '../store/useStore'

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

async function logout() {
  try {
    await api.logout()
  } catch {
    // ignore network error — clear locally and reload regardless
  }
  resetLocalState()
  window.location.reload()
}

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
          <button className="btn-ghost btn-sm" onClick={logout} style={{ width: '100%' }}>
            Log out
          </button>
          <div style={{ marginTop: 10 }}>
            Shared household account. Synced privately across your devices.
          </div>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}

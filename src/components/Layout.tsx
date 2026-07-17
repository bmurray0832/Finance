import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/transactions', label: 'Transactions', icon: '🧾' },
  { to: '/debts', label: 'Debt Payoff', icon: '💳' },
  { to: '/goals', label: 'Savings Goals', icon: '🎯' },
  { to: '/cashflow', label: 'Cash Flow', icon: '📈' },
  { to: '/rules', label: 'Category Rules', icon: '🏷️' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function Layout() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-badge">💰</span>
          <span>Finance</span>
        </div>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
          >
            <span className="nav-icon">{l.icon}</span>
            {l.label}
          </NavLink>
        ))}
        <div className="sidebar-footer">
          🔒 All data stays in your browser. Nothing is uploaded.
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}

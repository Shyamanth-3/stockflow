import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../AuthContext.jsx'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/products', label: 'Products' },
]

export default function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <span className="font-semibold text-slate-900">StockFlow</span>
            <nav className="flex gap-4">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/'}
                  className={({ isActive }) =>
                    isActive
                      ? 'text-sm font-medium text-indigo-600'
                      : 'text-sm text-slate-600 hover:text-slate-900'
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 truncate">{user.organizationName}</span>
            <button
              type="button"
              onClick={logout}
              className="text-sm text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

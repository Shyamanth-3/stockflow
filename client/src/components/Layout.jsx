import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../AuthContext.jsx'
import ErrorMessage from './ErrorMessage.jsx'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/products', label: 'Products' },
  { to: '/settings', label: 'Settings' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const [error, setError] = useState('')

  async function handleLogout() {
    setError('')
    try {
      await logout()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <span className="font-semibold text-slate-900">StockFlow</span>
          <nav className="order-last sm:order-none w-full sm:w-auto sm:grow flex gap-4">
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
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-sm text-slate-500 truncate max-w-48">
              {user.organizationName}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-sm text-slate-600 hover:text-slate-900 whitespace-nowrap cursor-pointer"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        {error && <ErrorMessage className="mb-4">{error}</ErrorMessage>}
        <Outlet />
      </main>
    </div>
  )
}

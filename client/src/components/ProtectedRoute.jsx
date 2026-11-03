import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../AuthContext.jsx'

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center text-slate-500">
      Loading StockFlow...
    </div>
  )
}

export function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />

  return <Outlet />
}

export function PublicOnlyRoute() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (user) return <Navigate to="/" replace />

  return <Outlet />
}

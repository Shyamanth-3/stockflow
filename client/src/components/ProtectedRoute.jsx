import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../AuthContext.jsx'
import ErrorMessage from './ErrorMessage.jsx'

function SessionScreen({ loading, sessionError, onRetry }) {
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading StockFlow...
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 px-4">
      <ErrorMessage>We couldn't check your session. {sessionError}</ErrorMessage>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 cursor-pointer"
      >
        Try again
      </button>
    </div>
  )
}

export function ProtectedRoute() {
  const { user, loading, sessionError, checkSession } = useAuth()

  if (loading || sessionError) {
    return <SessionScreen loading={loading} sessionError={sessionError} onRetry={checkSession} />
  }
  if (!user) return <Navigate to="/login" replace />

  return <Outlet />
}

export function PublicOnlyRoute() {
  const { user, loading, sessionError, checkSession } = useAuth()

  if (loading || sessionError) {
    return <SessionScreen loading={loading} sessionError={sessionError} onRetry={checkSession} />
  }
  if (user) return <Navigate to="/" replace />

  return <Outlet />
}

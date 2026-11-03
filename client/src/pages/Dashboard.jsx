import { useAuth } from '../AuthContext.jsx'

export default function Dashboard() {
  const { user } = useAuth()

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <p className="text-slate-600 mt-2">Logged in as {user.email}</p>
    </div>
  )
}

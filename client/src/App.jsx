import { useEffect, useState } from 'react'

export default function App() {
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus('unreachable'))
  }, [])

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-2 bg-slate-50">
      <h1 className="text-3xl font-semibold text-slate-900">StockFlow</h1>
      <p className="text-slate-600">API status: {status}</p>
    </main>
  )
}

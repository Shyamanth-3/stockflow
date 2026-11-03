import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'

function SummaryCard({ label, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="text-3xl font-semibold text-slate-900 mt-1">{value.toLocaleString()}</p>
    </div>
  )
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/dashboard')
      .then(setSummary)
      .catch((err) => setError(err.message))
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Dashboard</h1>

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {!summary && !error && <p className="text-slate-500">Loading dashboard...</p>}

      {summary && (
        <>
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <SummaryCard label="Total products" value={summary.totalProducts} />
            <SummaryCard label="Total units in stock" value={summary.totalUnits} />
          </div>

          <h2 className="text-lg font-semibold text-slate-900 mb-3">Low stock items</h2>

          {summary.totalProducts === 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
              <p className="text-slate-600">
                No products yet.{' '}
                <Link to="/products/new" className="text-indigo-600 hover:underline">
                  Add your first product
                </Link>
              </p>
            </div>
          )}

          {summary.totalProducts > 0 && summary.lowStockItems.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
              <p className="text-slate-600">Nothing is low on stock right now.</p>
            </div>
          )}

          {summary.lowStockItems.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">SKU</th>
                    <th className="px-4 py-3 font-medium text-right">Quantity on Hand</th>
                    <th className="px-4 py-3 font-medium text-right">Low Stock Threshold</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.lowStockItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-slate-900">{item.name}</td>
                      <td className="px-4 py-3 text-slate-600">{item.sku}</td>
                      <td className="px-4 py-3 text-right text-slate-900">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-slate-900">
                        {item.lowStockThreshold ?? `${summary.defaultLowStockThreshold} (default)`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

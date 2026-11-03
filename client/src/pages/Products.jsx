import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import AdjustStock from '../components/AdjustStock.jsx'

export default function Products() {
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [adjustingId, setAdjustingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCurrent = true
    const timer = setTimeout(() => {
      api(`/products?search=${encodeURIComponent(search)}`)
        .then((data) => {
          if (!isCurrent) return
          setProducts(data.products)
          setError('')
        })
        .catch((err) => {
          if (isCurrent) setError(err.message)
        })
        .finally(() => {
          if (isCurrent) setLoading(false)
        })
    }, 300)

    return () => {
      isCurrent = false
      clearTimeout(timer)
    }
  }, [search])

  async function handleDelete(product) {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return

    setError('')
    try {
      await api(`/products/${product.id}`, { method: 'DELETE' })
      setProducts((current) => current.filter((item) => item.id !== product.id))
    } catch (err) {
      setError(err.message)
    }
  }

  function handleAdjusted(updated) {
    setProducts((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    setAdjustingId(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Products</h1>
        <Link
          to="/products/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Add Product
        </Link>
      </div>

      <input
        type="search"
        aria-label="Search products by name or SKU"
        placeholder="Search by name or SKU"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full sm:max-w-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {loading && <p className="text-slate-500">Loading products...</p>}

      {!loading && !error && products.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
          <p className="text-slate-600">
            {search ? `No products match "${search}".` : 'No products yet. Add your first product to get started.'}
          </p>
        </div>
      )}

      {products.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium text-right">Quantity</th>
                <th className="px-4 py-3 font-medium">Low Stock</th>
                <th className="px-4 py-3 font-medium text-right">Selling Price</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product) => (
                <Fragment key={product.id}>
                  <tr>
                    <td className="px-4 py-3 text-slate-900">{product.name}</td>
                    <td className="px-4 py-3 text-slate-600">{product.sku}</td>
                    <td className="px-4 py-3 text-right text-slate-900">{product.quantity}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          product.isLowStock
                            ? 'rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800'
                            : 'rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800'
                        }
                      >
                        {product.isLowStock ? 'Low stock' : 'In stock'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900">{product.sellingPrice ?? '-'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setAdjustingId(product.id)}
                        className="text-indigo-600 hover:underline cursor-pointer"
                      >
                        Adjust
                      </button>
                      <Link to={`/products/${product.id}/edit`} className="ml-4 text-indigo-600 hover:underline">
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(product)}
                        className="ml-4 text-red-600 hover:underline cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                  {adjustingId === product.id && (
                    <tr className="bg-slate-50">
                      <td colSpan={6} className="px-4 py-3">
                        <AdjustStock
                          product={product}
                          onAdjusted={handleAdjusted}
                          onCancel={() => setAdjustingId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

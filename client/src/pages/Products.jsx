import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import AdjustStock from '../components/AdjustStock.jsx'
import ErrorMessage from '../components/ErrorMessage.jsx'
import { formatPrice } from '../format.js'

export default function Products() {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState({ search: '', page: 1 })
  const [reloadCount, setReloadCount] = useState(0)
  const [results, setResults] = useState(null)
  const [adjustingId, setAdjustingId] = useState(null)
  const [error, setError] = useState('')

  const products = results?.products ?? []
  const isCurrentSearch = results?.search === search
  const pageCount = results ? Math.ceil(results.total / results.pageSize) : 0

  useEffect(() => {
    if (search === query.search) return

    const timer = setTimeout(() => setQuery({ search, page: 1 }), search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [search, query.search])

  useEffect(() => {
    let isCurrent = true

    api(`/products?search=${encodeURIComponent(query.search)}&page=${query.page}`)
      .then((data) => {
        if (!isCurrent) return
        setResults({ ...data, search: query.search })
        setError('')
      })
      .catch((err) => {
        if (!isCurrent) return
        setResults((current) => (current?.search === query.search ? current : null))
        setError(err.message)
      })

    return () => {
      isCurrent = false
    }
  }, [query, reloadCount])

  async function handleDelete(product) {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return

    setError('')
    try {
      await api(`/products/${product.id}`, { method: 'DELETE' })
      if (products.length === 1 && query.page > 1) {
        setQuery({ ...query, page: query.page - 1 })
      } else {
        setReloadCount((count) => count + 1)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  function handleAdjusted(updated) {
    setResults(
      (current) =>
        current && {
          ...current,
          products: current.products.map((item) => (item.id === updated.id ? updated : item)),
        },
    )
    setAdjustingId(null)
    setReloadCount((count) => count + 1)
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
        maxLength={200}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full sm:max-w-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {error && <ErrorMessage className="mb-4">{error}</ErrorMessage>}

      {!results && !error && <p className="text-slate-500">Loading products...</p>}

      {results && !isCurrentSearch && <p className="text-sm text-slate-500 mb-4">Searching...</p>}

      {results && isCurrentSearch && products.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
          <p className="text-slate-600 break-words">
            {results.search
              ? `No products match "${results.search}".`
              : 'No products yet. Add your first product to get started.'}
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
                    <td className="px-4 py-3 text-slate-900 max-w-xs break-words">
                      {product.name}
                      {product.lastAdjustmentNote && (
                        <p className="text-xs text-slate-500 mt-1">
                          Latest note: {product.lastAdjustmentNote}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-40 break-words">{product.sku}</td>
                    <td className="px-4 py-3 text-right text-slate-900">{product.quantity}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          product.isLowStock
                            ? 'rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 whitespace-nowrap'
                            : 'rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 whitespace-nowrap'
                        }
                      >
                        {product.isLowStock ? 'Low stock' : 'In stock'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-900">
                      {product.sellingPrice === null ? '-' : formatPrice(product.sellingPrice)}
                    </td>
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
                          onOutcomeUnknown={() => setReloadCount((count) => count + 1)}
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

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-4 mt-4 text-sm text-slate-600">
          <button
            type="button"
            disabled={results.page <= 1}
            onClick={() => setQuery({ ...query, page: results.page - 1 })}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span>
            Page {results.page} of {pageCount} ({results.total} products)
          </span>
          <button
            type="button"
            disabled={results.page >= pageCount}
            onClick={() => setQuery({ ...query, page: results.page + 1 })}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

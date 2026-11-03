import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'

export default function Products() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/products')
      .then((data) => setProducts(data.products))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

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

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {loading && <p className="text-slate-500">Loading products...</p>}

      {!loading && !error && products.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
          <p className="text-slate-600">No products yet. Add your first product to get started.</p>
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
                <tr key={product.id}>
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
                    <Link to={`/products/${product.id}/edit`} className="text-indigo-600 hover:underline">
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

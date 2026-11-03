import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api.js'
import Field from '../components/Field.jsx'

const emptyForm = {
  name: '',
  sku: '',
  description: '',
  quantity: '',
  costPrice: '',
  sellingPrice: '',
  lowStockThreshold: '',
}

function toFormValues(product) {
  return Object.fromEntries(
    Object.keys(emptyForm).map((key) => [key, product[key] === null ? '' : String(product[key])]),
  )
}

export default function ProductForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(Boolean(id))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return

    api(`/products/${id}`)
      .then((data) => setForm(toFormValues(data.product)))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api(id ? `/products/${id}` : '/products', {
        method: id ? 'PUT' : 'POST',
        body: form,
      })
      navigate('/products')
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  if (loading) return <p className="text-slate-500">Loading product...</p>

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">
        {id ? 'Edit Product' : 'Add Product'}
      </h1>
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
        {error && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2">
            {error}
          </p>
        )}
        <Field label="Name" id="name" required value={form.name} onChange={handleChange} />
        <Field label="SKU" id="sku" required value={form.sku} onChange={handleChange} />
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">
            Description (optional)
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            value={form.description}
            onChange={handleChange}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <Field label="Quantity on Hand" id="quantity" type="number" min="0" step="1" required value={form.quantity} onChange={handleChange} />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Cost Price (optional)" id="costPrice" type="number" min="0" step="0.01" value={form.costPrice} onChange={handleChange} />
          <Field label="Selling Price (optional)" id="sellingPrice" type="number" min="0" step="0.01" value={form.sellingPrice} onChange={handleChange} />
        </div>
        <div>
          <Field label="Low Stock Threshold (optional)" id="lowStockThreshold" type="number" min="0" step="1" value={form.lowStockThreshold} onChange={handleChange} />
          <p className="text-xs text-slate-500 mt-1">Leave empty to use your default threshold.</p>
        </div>
        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving...' : 'Save Product'}
          </button>
          <Link to="/products" className="text-sm text-slate-600 hover:text-slate-900">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

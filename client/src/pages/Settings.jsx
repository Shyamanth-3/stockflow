import { useEffect, useState } from 'react'
import { api } from '../api.js'
import ErrorMessage from '../components/ErrorMessage.jsx'
import Field from '../components/Field.jsx'

export default function Settings() {
  const [threshold, setThreshold] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api('/settings')
      .then((data) => setThreshold(String(data.defaultLowStockThreshold)))
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaved(false)
    setSubmitting(true)
    try {
      const data = await api('/settings', {
        method: 'PUT',
        body: { defaultLowStockThreshold: threshold },
      })
      setThreshold(String(data.defaultLowStockThreshold))
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Settings</h1>

      {loading && <p className="text-slate-500">Loading settings...</p>}

      {loadError && <ErrorMessage>{loadError}</ErrorMessage>}

      {!loading && !loadError && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          {error && <ErrorMessage>{error}</ErrorMessage>}
          {saved && (
            <p role="status" className="text-sm text-emerald-800 bg-emerald-50 rounded-md px-3 py-2">
              Settings saved
            </p>
          )}
          <div>
            <Field
              label="Default Low Stock Threshold"
              id="defaultLowStockThreshold"
              type="number"
              min="0"
              step="1"
              required
              disabled={submitting}
              value={threshold}
              onChange={(e) => {
                setThreshold(e.target.value)
                setSaved(false)
              }}
            />
            <p className="text-xs text-slate-500 mt-1">
              Used for any product that does not have its own threshold.
            </p>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      )}
    </div>
  )
}

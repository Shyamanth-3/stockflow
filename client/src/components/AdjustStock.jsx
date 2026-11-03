import { useState } from 'react'
import { api } from '../api.js'
import ErrorMessage from './ErrorMessage.jsx'

export default function AdjustStock({ product, onAdjusted, onOutcomeUnknown, onCancel }) {
  const [change, setChange] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const data = await api(`/products/${product.id}/adjust`, {
        method: 'POST',
        body: { change: Number(change), note },
      })
      onAdjusted(data.product)
    } catch (err) {
      const outcomeUnknown = !err.status || err.status >= 500
      setError(
        outcomeUnknown
          ? `${err.message} The stock may have changed, so check the quantity before trying again.`
          : err.message,
      )
      setSubmitting(false)
      if (outcomeUnknown) onOutcomeUnknown()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor={`change-${product.id}`} className="block text-xs font-medium text-slate-700 mb-1">
          +/- units
        </label>
        <input
          id={`change-${product.id}`}
          type="number"
          step="1"
          required
          autoFocus
          placeholder="-3"
          value={change}
          onChange={(e) => setChange(e.target.value)}
          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div className="grow">
        <label htmlFor={`note-${product.id}`} className="block text-xs font-medium text-slate-700 mb-1">
          Note (optional)
        </label>
        <input
          id={`note-${product.id}`}
          maxLength={200}
          placeholder="Damaged in storage"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
      >
        {submitting ? 'Saving...' : 'Apply'}
      </button>
      <button type="button" onClick={onCancel} className="text-sm text-slate-600 hover:text-slate-900 cursor-pointer py-1.5">
        Cancel
      </button>
      {error && <ErrorMessage className="w-full">{error}</ErrorMessage>}
    </form>
  )
}

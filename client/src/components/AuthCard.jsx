import ErrorMessage from './ErrorMessage.jsx'

export default function AuthCard({ title, error, submitLabel, submitting, onSubmit, children, footer }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-sm">
        <p className="text-center font-semibold text-slate-900 mb-6">StockFlow</p>
        <form onSubmit={onSubmit} className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          {children}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
          >
            {submitting ? 'Please wait...' : submitLabel}
          </button>
        </form>
        <p className="text-center text-sm text-slate-600 mt-4">{footer}</p>
      </div>
    </div>
  )
}

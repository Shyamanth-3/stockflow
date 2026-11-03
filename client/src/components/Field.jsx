export default function Field({ label, id, ...inputProps }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>
      <input
        id={id}
        name={id}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        {...inputProps}
      />
    </div>
  )
}

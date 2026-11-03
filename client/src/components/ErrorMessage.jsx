export default function ErrorMessage({ children, className = '' }) {
  return (
    <p role="alert" className={`text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 ${className}`}>
      {children}
    </p>
  )
}

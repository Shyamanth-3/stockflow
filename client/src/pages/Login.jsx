import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../AuthContext.jsx'
import AuthCard from '../components/AuthCard.jsx'
import Field from '../components/Field.jsx'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login({ email, password })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <AuthCard
      title="Log in"
      error={error}
      submitLabel="Log in"
      submitting={submitting}
      onSubmit={handleSubmit}
      footer={
        <>
          New to StockFlow?{' '}
          <Link to="/signup" className="text-indigo-600 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <Field label="Email" id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Field label="Password" id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
    </AuthCard>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../AuthContext.jsx'
import AuthCard from '../components/AuthCard.jsx'
import Field from '../components/Field.jsx'

export default function Signup() {
  const { signup } = useAuth()
  const [form, setForm] = useState({
    organizationName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      await signup({
        organizationName: form.organizationName,
        email: form.email,
        password: form.password,
      })
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <AuthCard
      title="Create your account"
      error={error}
      submitLabel="Sign up"
      submitting={submitting}
      onSubmit={handleSubmit}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-600 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <Field label="Organization name" id="organizationName" required maxLength={100} placeholder="My Test Store" value={form.organizationName} onChange={handleChange} />
      <Field label="Email" id="email" type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={handleChange} />
      <div>
        <Field label="Password" id="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={form.password} onChange={handleChange} />
        <p className="text-xs text-slate-500 mt-1">At least 8 characters, with a letter and a number.</p>
      </div>
      <Field label="Confirm password" id="confirmPassword" type="password" autoComplete="new-password" required value={form.confirmPassword} onChange={handleChange} />
    </AuthCard>
  )
}

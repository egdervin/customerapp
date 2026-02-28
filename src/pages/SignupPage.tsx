import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Logo } from '../components/Logo'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { useAuthStore } from '../stores/authStore'

interface FormErrors {
  firstName?: string
  lastName?: string
  email?: string
  password?: string
}

function validatePassword(password: string): string | undefined {
  if (password.length < 8) return 'At least 8 characters required'
  if (!/[A-Z]/.test(password)) return 'Include at least one uppercase letter'
  if (!/[a-z]/.test(password)) return 'Include at least one lowercase letter'
  if (!/\d/.test(password)) return 'Include at least one number'
  if (!/[!@#$%^&*]/.test(password)) return 'Include at least one special character (!@#$%^&*)'
}

export function SignupPage() {
  const navigate = useNavigate()
  const { signUp } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' })
  const [errors, setErrors] = useState<FormErrors>({})

  const validate = (): boolean => {
    const e: FormErrors = {}
    if (!form.firstName.trim()) e.firstName = 'First name is required'
    if (!form.lastName.trim()) e.lastName = 'Last name is required'
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = 'Valid email address required'
    const pwError = validatePassword(form.password)
    if (pwError) e.password = pwError
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    const { error } = await signUp(form.email, form.password, form.firstName, form.lastName)
    setLoading(false)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Welcome to Plusdine!')
      navigate('/home')
    }
  }

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }))
      if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }))
    }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--pd-off-white)',
    }}>
      {/* Top bar */}
      <header style={{
        padding: 'var(--space-lg) var(--space-xl)',
        borderBottom: '1px solid var(--pd-gray-light)',
        background: 'var(--pd-white)',
      }}>
        <Logo size="sm" variant="dark" />
      </header>

      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--space-xl)',
        maxWidth: 480,
        width: '100%',
        margin: '0 auto',
      }}>
        <div className="animate-fade-up" style={{ marginBottom: 'var(--space-xl)' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '32px',
            fontWeight: 400,
            color: 'var(--pd-text)',
            marginBottom: 'var(--space-sm)',
          }}>
            Create your account
          </h1>
          <p style={{ color: 'rgba(28,26,24,0.55)', fontSize: '15px' }}>
            Already have a Plusdine operator account?{' '}
            <Link to="/login" style={{ color: 'var(--pd-green)', fontWeight: 500, textDecoration: 'none' }}>
              Sign in instead
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>

          <div className="animate-fade-up animate-fade-up-delay-1"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <Input
              label="First name"
              type="text"
              value={form.firstName}
              onChange={set('firstName')}
              error={errors.firstName}
              autoComplete="given-name"
              autoFocus
            />
            <Input
              label="Last name"
              type="text"
              value={form.lastName}
              onChange={set('lastName')}
              error={errors.lastName}
              autoComplete="family-name"
            />
          </div>

          <div className="animate-fade-up animate-fade-up-delay-2">
            <Input
              label="Email address"
              type="email"
              value={form.email}
              onChange={set('email')}
              error={errors.email}
              autoComplete="email"
              inputMode="email"
            />
          </div>

          <div className="animate-fade-up animate-fade-up-delay-3">
            <Input
              label="Password"
              type="password"
              value={form.password}
              onChange={set('password')}
              error={errors.password}
              autoComplete="new-password"
            />
          </div>

          {/* Password requirements hint */}
          <div className="animate-fade-up animate-fade-up-delay-3"
            style={{
              padding: 'var(--space-sm) var(--space-md)',
              background: 'var(--pd-gray-light)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              color: 'rgba(28,26,24,0.55)',
              lineHeight: 1.6,
            }}>
            Password needs: 8+ chars, uppercase, lowercase, number, and a special character (!@#$%^&*)
          </div>

          <div className="animate-fade-up animate-fade-up-delay-4" style={{ marginTop: 'var(--space-sm)' }}>
            <Button type="submit" variant="primary" loading={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </div>
        </form>

        <div className="animate-fade-up animate-fade-up-delay-4"
          style={{ marginTop: 'var(--space-lg)', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: 'rgba(28,26,24,0.45)' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--pd-green)', fontWeight: 500, textDecoration: 'none' }}>
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}

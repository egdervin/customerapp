import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Logo } from '../components/Logo'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { useAuthStore } from '../stores/authStore'

export function LoginPage() {
  const navigate = useNavigate()
  const { signIn } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const e2: typeof errors = {}
    if (!email.trim()) e2.email = 'Email is required'
    if (!password) e2.password = 'Password is required'
    if (Object.keys(e2).length) { setErrors(e2); return }

    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)

    if (error) {
      toast.error('Invalid email or password')
    } else {
      navigate('/home')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--pd-off-white)',
    }}>
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
            Welcome back
          </h1>
          <p style={{ color: 'rgba(28,26,24,0.55)', fontSize: '15px' }}>
            Sign in to your Plusdine account
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>

          <div className="animate-fade-up animate-fade-up-delay-1">
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })) }}
              error={errors.email}
              autoComplete="email"
              inputMode="email"
              autoFocus
            />
          </div>

          <div className="animate-fade-up animate-fade-up-delay-2">
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })) }}
              error={errors.password}
              autoComplete="current-password"
            />
          </div>

          <div className="animate-fade-up animate-fade-up-delay-3" style={{ marginTop: 'var(--space-sm)' }}>
            <Button type="submit" variant="primary" loading={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </div>
        </form>

        <div className="animate-fade-up animate-fade-up-delay-4"
          style={{ marginTop: 'var(--space-lg)', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: 'rgba(28,26,24,0.45)' }}>
            Don't have an account?{' '}
            <Link to="/signup" style={{ color: 'var(--pd-green)', fontWeight: 500, textDecoration: 'none' }}>
              Create one
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}

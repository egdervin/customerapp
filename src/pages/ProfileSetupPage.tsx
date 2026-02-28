import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Logo } from '../components/Logo'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { useAuthStore } from '../stores/authStore'

export function ProfileSetupPage() {
  const navigate = useNavigate()
  const { user, completeProfileSetup, signOut } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({})

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!firstName.trim()) errs.firstName = 'First name is required'
    if (!lastName.trim()) errs.lastName = 'Last name is required'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setLoading(true)
    const { error } = await completeProfileSetup(firstName.trim(), lastName.trim())
    setLoading(false)

    if (error) {
      toast.error(error)
    } else {
      toast.success('Your customer account is ready!')
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
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Logo size="sm" variant="dark" />
        <button
          onClick={() => signOut()}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '14px', color: 'rgba(28,26,24,0.45)',
          }}
        >
          Sign out
        </button>
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
        {/* Amber accent strip */}
        <div className="animate-fade-up" style={{
          width: 40, height: 4, background: 'var(--pd-yellow)',
          borderRadius: 2, marginBottom: 'var(--space-lg)',
        }} />

        <div className="animate-fade-up" style={{ marginBottom: 'var(--space-xl)' }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '30px',
            fontWeight: 400,
            color: 'var(--pd-text)',
            marginBottom: 'var(--space-sm)',
          }}>
            One more step
          </h1>
          <p style={{ color: 'rgba(28,26,24,0.6)', fontSize: '15px', lineHeight: 1.6 }}>
            We recognized your existing Plusdine login{user?.email ? ` (${user.email})` : ''}. 
            Set up your customer profile to start using the café app.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="animate-fade-up animate-fade-up-delay-1"
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <Input
              label="First name"
              type="text"
              value={firstName}
              onChange={e => { setFirstName(e.target.value); setErrors(p => ({ ...p, firstName: undefined })) }}
              error={errors.firstName}
              autoFocus
            />
            <Input
              label="Last name"
              type="text"
              value={lastName}
              onChange={e => { setLastName(e.target.value); setErrors(p => ({ ...p, lastName: undefined })) }}
              error={errors.lastName}
            />
          </div>

          <div className="animate-fade-up animate-fade-up-delay-2" style={{ marginTop: 'var(--space-sm)' }}>
            <Button type="submit" variant="primary" loading={loading}>
              {loading ? 'Setting up…' : 'Complete setup'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}

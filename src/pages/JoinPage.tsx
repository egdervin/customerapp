import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { Logo } from '../components/Logo'
import { Button } from '../components/Button'

type State = 'loading' | 'connecting' | 'success' | 'already' | 'error' | 'needs-auth'

export function JoinPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user, customerProfile, loading, connectLocation } = useAuthStore()
  const [state, setState] = useState<State>('loading')
  const [locationName, setLocationName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (loading) return // wait for auth to initialize

    if (!user || !customerProfile) {
      // Not logged in — send to signup, preserve token in URL so we can come back
      setState('needs-auth')
      return
    }

    if (!token) {
      setState('error')
      setErrorMsg('Invalid link — no location code found.')
      return
    }

    // Auto-connect the location
    setState('connecting')
    connectLocation(token).then(({ error, locationName }) => {
      if (error) {
        // Check if it's the "already connected" case (no error but locationName returned)
        setState('error')
        setErrorMsg(error)
      } else if (locationName) {
        setLocationName(locationName)
        // Check if we were already connected
        setState('success')
        // Auto-redirect to home after 2.5s
        setTimeout(() => navigate('/home'), 2500)
      }
    })
  }, [loading, user, customerProfile, token])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--pd-off-white)',
      padding: 'var(--page-px)',
      paddingTop: 'calc(var(--safe-top) + var(--space-lg))',
      paddingBottom: 'calc(var(--safe-bottom) + var(--space-lg))',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 380,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-lg)',
        textAlign: 'center',
      }}>
        <Logo size="md" variant="dark" />

        {(state === 'loading' || state === 'connecting') && (
          <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-md)' }}>
            <div style={{
              width: 56, height: 56,
              border: '3px solid var(--pd-gray-light)',
              borderTop: '3px solid var(--pd-green)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <p style={{ fontSize: 'var(--text-base)', color: 'var(--pd-text-muted)' }}>
              {state === 'loading' ? 'Loading…' : 'Connecting to location…'}
            </p>
          </div>
        )}

        {state === 'success' && (
          <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-md)' }}>
            <div style={{
              width: 72, height: 72,
              background: 'var(--pd-yellow)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '36px',
            }}>
              ✓
            </div>
            <div>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-2xl)',
                color: 'var(--pd-text)',
                marginBottom: 8,
              }}>
                Connected!
              </p>
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--pd-text-muted)' }}>
                {locationName} has been added to your locations.
              </p>
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--pd-text-muted)' }}>
              Taking you to your wallet…
            </p>
          </div>
        )}

        {state === 'needs-auth' && (
          <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-md)', width: '100%' }}>
            <div style={{
              width: 72, height: 72,
              background: 'var(--pd-green-light)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '36px',
            }}>
              👋
            </div>
            <div>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-2xl)',
                color: 'var(--pd-text)',
                marginBottom: 8,
              }}>
                Sign in first
              </p>
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--pd-text-muted)', lineHeight: 1.55 }}>
                Create an account or sign in, then you'll be connected to this location automatically.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', width: '100%' }}>
              <Button variant="primary" onClick={() => navigate(`/signup?next=/join/${token}`)}>
                Create account
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/login?next=/join/${token}`)}>
                Sign in
              </Button>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-md)', width: '100%' }}>
            <div style={{
              width: 72, height: 72,
              background: '#fde8e8',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '36px',
            }}>
              ✕
            </div>
            <div>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-2xl)',
                color: 'var(--pd-text)',
                marginBottom: 8,
              }}>
                Something went wrong
              </p>
              <p style={{ fontSize: 'var(--text-base)', color: 'var(--pd-text-muted)' }}>
                {errorMsg}
              </p>
            </div>
            <Button variant="primary" onClick={() => navigate('/home')}>
              Go to my wallet
            </Button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

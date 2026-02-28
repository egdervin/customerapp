import { useNavigate } from 'react-router-dom'
import { Logo } from '../components/Logo'
import { Button } from '../components/Button'

export function LandingPage() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--pd-green-dark)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `
          radial-gradient(ellipse 80% 50% at 50% -5%, rgba(232,242,42,0.12) 0%, transparent 70%),
          radial-gradient(ellipse 40% 40% at 90% 100%, rgba(20,90,16,0.6) 0%, transparent 60%)
        `,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', right: -80, top: -80,
        width: 320, height: 320, borderRadius: '50%',
        border: '1.5px solid rgba(232,242,42,0.1)', pointerEvents: 'none',
      }} />

      <header style={{ padding: 'var(--space-xl) var(--space-xl) 0', position: 'relative', zIndex: 1 }}>
        <div className="animate-fade-up"><Logo size="md" variant="light" /></div>
      </header>

      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: 'var(--space-xl)',
        position: 'relative', zIndex: 1,
      }}>
        <div className="animate-fade-up animate-fade-up-delay-1">
          <p style={{
            fontSize: '12px', fontWeight: 600, color: 'var(--pd-yellow)',
            letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 'var(--space-md)',
          }}>Your café, your account</p>
        </div>

        <div className="animate-fade-up animate-fade-up-delay-2">
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 9vw, 54px)',
            fontWeight: 400, color: '#ffffff', lineHeight: 1.1, marginBottom: 'var(--space-lg)',
          }}>
            Dining made<br />
            <em style={{ color: 'var(--pd-yellow)' }}>effortless</em>
          </h1>
        </div>

        <div className="animate-fade-up animate-fade-up-delay-3">
          <p style={{
            fontSize: '16px', color: 'rgba(255,255,255,0.6)',
            lineHeight: 1.65, marginBottom: 'var(--space-2xl)', maxWidth: 300,
          }}>
            Check your balance, browse menus, and pay with a scan — all from your phone.
          </p>
        </div>

        <div className="animate-fade-up animate-fade-up-delay-4"
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <Button variant="primary" onClick={() => navigate('/signup')}
            style={{ fontSize: '17px', padding: '16px 24px' }}>
            Create account
          </Button>
          <Button variant="ghost" onClick={() => navigate('/login')}
            style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.2)', fontSize: '17px', padding: '16px 24px' }}>
            Sign in
          </Button>
        </div>
      </main>

      <footer style={{ padding: 'var(--space-lg) var(--space-xl)', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.05em' }}>
          Powered by Plusdine · Scan. Order. Enjoy.
        </p>
      </footer>
    </div>
  )
}

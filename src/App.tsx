import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './stores/authStore'
import { LandingPage } from './pages/LandingPage'
import { SignupPage } from './pages/SignupPage'
import { LoginPage } from './pages/LoginPage'
import { ProfileSetupPage } from './pages/ProfileSetupPage'
import { HomePage } from './pages/HomePage'
import { JoinPage } from './pages/JoinPage'
import { InstallPrompt } from './components/InstallPrompt'
import './index.css'

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, customerProfile, needsProfileSetup, loading } = useAuthStore()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--pd-green-dark)',
      }}>
        <div style={{
          width: 32, height: 32,
          border: '3px solid var(--pd-yellow)',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  if (needsProfileSetup) return <Navigate to="/setup" replace />
  if (!customerProfile) return <Navigate to="/setup" replace />

  return <>{children}</>
}

function PublicGuard({ children }: { children: React.ReactNode }) {
  const { user, customerProfile, needsProfileSetup, loading } = useAuthStore()
  const location = useLocation()
  const next = new URLSearchParams(location.search).get('next')

  if (loading) return null
  if (user && !needsProfileSetup && customerProfile) {
    return <Navigate to={next || '/home'} replace />
  }
  if (user && needsProfileSetup) return <Navigate to="/setup" replace />
  return <>{children}</>
}

export default function App() {
  const { initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            fontFamily: 'var(--font-body)',
            background: 'var(--pd-green-dark)',
            color: 'var(--pd-white)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-base)',
          },
          success: {
            iconTheme: { primary: 'var(--pd-yellow)', secondary: 'var(--pd-green-dark)' },
          },
        }}
      />
      <InstallPrompt />
      <Routes>
        <Route path="/"        element={<PublicGuard><LandingPage /></PublicGuard>} />
        <Route path="/signup"  element={<PublicGuard><SignupPage /></PublicGuard>} />
        <Route path="/login"   element={<PublicGuard><LoginPage /></PublicGuard>} />
        <Route path="/setup"   element={<ProfileSetupPage />} />
        <Route path="/home"    element={<AuthGuard><HomePage /></AuthGuard>} />
        <Route path="/join/:token" element={<JoinPage />} />
        <Route path="*"        element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

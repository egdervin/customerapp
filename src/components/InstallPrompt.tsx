import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)

  useEffect(() => {
    // Check if already installed as PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in window.navigator && (window.navigator as any).standalone === true)
    setIsStandalone(standalone)

    // Check iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIOS(ios)

    // Check if user previously dismissed
    const wasDismissed = localStorage.getItem('pwa-prompt-dismissed')
    if (wasDismissed) setDismissed(true)

    // Capture Android install event
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function handleDismiss() {
    setDismissed(true)
    localStorage.setItem('pwa-prompt-dismissed', '1')
  }

  async function handleInstallAndroid() {
    if (!installEvent) return
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    if (outcome === 'accepted') setInstallEvent(null)
    else handleDismiss()
  }

  // Don't show if: already installed, dismissed, or not on mobile
  if (isStandalone || dismissed) return null

  // Android — show branded install button
  if (installEvent) {
    return (
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        padding: '16px',
        background: 'var(--pd-white)',
        borderTop: '1px solid var(--pd-gray-light)',
        boxShadow: '0 -4px 24px rgba(15,20,15,0.12)',
        display: 'flex', alignItems: 'center', gap: '12px',
        maxWidth: 480, margin: '0 auto',
      }}>
        {/* App icon */}
        <img src="/icons/icon-72x72.png" alt="Plusdine"
          style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--pd-text)', marginBottom: 2 }}>
            Add Plusdine to your home screen
          </p>
          <p style={{ fontSize: '12px', color: 'var(--pd-text-muted)' }}>
            Quick access to your balance and QR code
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={handleDismiss} style={{
            background: 'none', border: 'none', padding: '8px',
            cursor: 'pointer', color: 'var(--pd-text-muted)', fontSize: '18px', lineHeight: 1,
          }}>✕</button>
          <button onClick={handleInstallAndroid} style={{
            background: 'var(--pd-yellow)', color: 'var(--pd-green-dark)',
            border: 'none', borderRadius: 8, padding: '8px 16px',
            fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}>
            Add
          </button>
        </div>
      </div>
    )
  }

  // iOS — show instructions banner
  if (isIOS && !showIOSInstructions) {
    return (
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        padding: '16px',
        background: 'var(--pd-white)',
        borderTop: '1px solid var(--pd-gray-light)',
        boxShadow: '0 -4px 24px rgba(15,20,15,0.12)',
        display: 'flex', alignItems: 'center', gap: '12px',
        maxWidth: 480, margin: '0 auto',
      }}>
        <img src="/icons/icon-72x72.png" alt="Plusdine"
          style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--pd-text)', marginBottom: 2 }}>
            Add Plusdine to your home screen
          </p>
          <p style={{ fontSize: '12px', color: 'var(--pd-text-muted)' }}>
            Tap for instructions
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={handleDismiss} style={{
            background: 'none', border: 'none', padding: '8px',
            cursor: 'pointer', color: 'var(--pd-text-muted)', fontSize: '18px', lineHeight: 1,
          }}>✕</button>
          <button onClick={() => setShowIOSInstructions(true)} style={{
            background: 'var(--pd-yellow)', color: 'var(--pd-green-dark)',
            border: 'none', borderRadius: 8, padding: '8px 16px',
            fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            fontFamily: 'var(--font-body)',
          }}>
            How
          </button>
        </div>
      </div>
    )
  }

  // iOS step-by-step instructions modal
  if (isIOS && showIOSInstructions) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-end',
      }} onClick={() => { setShowIOSInstructions(false); handleDismiss() }}>
        <div style={{
          width: '100%', maxWidth: 480, margin: '0 auto',
          background: 'var(--pd-white)',
          borderRadius: '20px 20px 0 0',
          padding: '24px 24px 40px',
        }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <img src="/icons/icon-72x72.png" alt="Plusdine"
              style={{ width: 48, height: 48, borderRadius: 12 }} />
            <div>
              <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--pd-text)' }}>
                Add to Home Screen
              </p>
              <p style={{ fontSize: '13px', color: 'var(--pd-text-muted)' }}>3 easy steps</p>
            </div>
          </div>

          {[
            { step: '1', icon: '⬆️', text: 'Tap the Share button at the bottom of your browser' },
            { step: '2', icon: '➕', text: 'Scroll down and tap "Add to Home Screen"' },
            { step: '3', icon: '✅', text: 'Tap "Add" in the top right corner' },
          ].map(({ step, icon, text }) => (
            <div key={step} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '12px 0',
              borderBottom: step !== '3' ? '1px solid var(--pd-gray-light)' : 'none',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--pd-green-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px', flexShrink: 0,
              }}>
                {icon}
              </div>
              <p style={{ fontSize: '14px', color: 'var(--pd-text)', lineHeight: 1.5 }}>{text}</p>
            </div>
          ))}

          <button
            onClick={() => { setShowIOSInstructions(false); handleDismiss() }}
            style={{
              marginTop: 24, width: '100%',
              background: 'var(--pd-green)', color: '#fff',
              border: 'none', borderRadius: 10, padding: '14px',
              fontSize: '15px', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            Got it
          </button>
        </div>
        {/* iOS arrow pointing to share button */}
        <div style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          fontSize: '32px', marginBottom: 8, pointerEvents: 'none',
        }}>
          ▼
        </div>
      </div>
    )
  }

  return null
}

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface QrScannerProps {
  onScan: (token: string) => void
  onClose: () => void
}

export function QrScanner({ onScan, onClose }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const containerId = 'qr-scanner-container'

  useEffect(() => {
    const scanner = new Html5Qrcode(containerId)
    scannerRef.current = scanner

    scanner.start(
      { facingMode: 'environment' }, // rear camera
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (decodedText) => {
        // Extract token from full URL or use as-is if just a code
        let token = decodedText.trim()
        const joinMatch = token.match(/\/join\/([A-Z0-9]+)/i)
        if (joinMatch) token = joinMatch[1]

        scanner.stop().catch(() => {})
        onScan(token.toUpperCase())
      },
      () => {} // ignore per-frame errors
    ).catch(err => {
      setError(
        err?.message?.includes('Permission')
          ? 'Camera permission denied. Please allow camera access and try again.'
          : 'Could not start camera. Try entering the code manually instead.'
      )
    })

    return () => {
      scanner.stop().catch(() => {})
    }
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      paddingTop: 'calc(var(--safe-top) + 16px)',
      paddingBottom: 'calc(var(--safe-bottom) + 16px)',
    }}>
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 'calc(var(--safe-top) + 16px)', right: 20,
          background: 'rgba(255,255,255,0.15)', border: 'none',
          borderRadius: '50%', width: 44, height: 44,
          color: '#fff', fontSize: '20px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ✕
      </button>

      <p style={{
        color: '#fff', fontSize: 'var(--text-lg)', fontFamily: 'var(--font-body)',
        fontWeight: 600, marginBottom: 32, textAlign: 'center',
        paddingLeft: 16, paddingRight: 16,
      }}>
        Scan a location QR code
      </p>

      {error ? (
        <div style={{
          background: 'rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)',
          padding: '24px', maxWidth: 300, textAlign: 'center',
        }}>
          <p style={{ color: '#fff', fontSize: 'var(--text-base)', lineHeight: 1.55 }}>{error}</p>
          <button
            onClick={onClose}
            style={{
              marginTop: 20, background: 'var(--pd-yellow)',
              color: 'var(--pd-green-dark)', border: 'none',
              borderRadius: 'var(--radius-sm)', padding: '12px 24px',
              fontSize: 'var(--text-base)', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}
          >
            Use code instead
          </button>
        </div>
      ) : (
        <>
          {/* Scanner viewport */}
          <div style={{
            position: 'relative', borderRadius: 'var(--radius-lg)',
            overflow: 'hidden', boxShadow: '0 0 0 4px var(--pd-yellow)',
          }}>
            <div id={containerId} style={{ width: 280, height: 280 }} />
            {/* Corner markers */}
            {['tl','tr','bl','br'].map(c => (
              <div key={c} style={{
                position: 'absolute',
                top:    c.startsWith('t') ? 0 : 'auto',
                bottom: c.startsWith('b') ? 0 : 'auto',
                left:   c.endsWith('l')   ? 0 : 'auto',
                right:  c.endsWith('r')   ? 0 : 'auto',
                width: 24, height: 24,
                borderTop:    c.startsWith('t') ? '3px solid var(--pd-yellow)' : 'none',
                borderBottom: c.startsWith('b') ? '3px solid var(--pd-yellow)' : 'none',
                borderLeft:   c.endsWith('l')   ? '3px solid var(--pd-yellow)' : 'none',
                borderRight:  c.endsWith('r')   ? '3px solid var(--pd-yellow)' : 'none',
              }} />
            ))}
          </div>
          <p style={{
            color: 'rgba(255,255,255,0.5)', fontSize: 'var(--text-sm)',
            marginTop: 28, textAlign: 'center',
          }}>
            Point your camera at the QR code
          </p>
        </>
      )}
    </div>
  )
}

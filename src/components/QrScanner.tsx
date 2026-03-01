import { useEffect, useRef, useState } from 'react'
import QrScannerLib from 'qr-scanner'

interface QrScannerProps {
  onScan: (token: string) => void
  onClose: () => void
}

export function QrScanner({ onScan, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScannerLib | null>(null)
  const [error, setError] = useState<string | null>(null)
  const hasScanned = useRef(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const scanner = new QrScannerLib(
      video,
      (result) => {
        if (hasScanned.current) return
        hasScanned.current = true

        let token = result.data.trim()
        // Extract token from full URL if scanned from PBO
        const joinMatch = token.match(/\/join\/([A-Z0-9]+)/i)
        if (joinMatch) token = joinMatch[1]

        scanner.stop()
        onScan(token.toUpperCase())
      },
      {
        preferredCamera: 'environment',
        highlightScanRegion: true,
        highlightCodeOutline: true,
        maxScansPerSecond: 5,
      }
    )

    scannerRef.current = scanner

    scanner.start().catch(err => {
      console.error('QR scanner error:', err)
      setError(
        String(err).toLowerCase().includes('permission')
          ? 'Camera permission denied. Please allow camera access in your browser settings.'
          : 'Could not start camera. Try entering the code manually.'
      )
    })

    return () => {
      scanner.stop()
      scanner.destroy()
    }
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#000',
      display: 'flex', flexDirection: 'column',
      paddingTop: 'calc(var(--safe-top) + 0px)',
      paddingBottom: 'calc(var(--safe-bottom) + 0px)',
    }}>
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 'calc(var(--safe-top) + 16px)',
          right: 20, zIndex: 201,
          background: 'rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: '50%', width: 44, height: 44,
          color: '#fff', fontSize: '20px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ✕
      </button>

      {/* Label */}
      <div style={{
        position: 'absolute',
        top: 'calc(var(--safe-top) + 20px)',
        left: 0, right: 0, zIndex: 201,
        textAlign: 'center',
        pointerEvents: 'none',
      }}>
        <p style={{
          color: '#fff', fontSize: 'var(--text-lg)',
          fontFamily: 'var(--font-body)', fontWeight: 600,
          textShadow: '0 1px 4px rgba(0,0,0,0.8)',
        }}>
          Scan location QR code
        </p>
      </div>

      {error ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '32px', gap: 'var(--space-md)',
          textAlign: 'center',
        }}>
          <p style={{ color: '#fff', fontSize: 'var(--text-base)', lineHeight: 1.6 }}>{error}</p>
          <button
            onClick={onClose}
            style={{
              background: 'var(--pd-yellow)', color: 'var(--pd-green-dark)',
              border: 'none', borderRadius: 'var(--radius-md)',
              padding: '14px 28px', fontSize: 'var(--text-base)',
              fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}
          >
            Use code instead
          </button>
        </div>
      ) : (
        <>
          {/* Full-screen video */}
          <video
            ref={videoRef}
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover',
            }}
          />
          {/* Hint at bottom */}
          <div style={{
            position: 'absolute', bottom: 'calc(var(--safe-bottom) + 32px)',
            left: 0, right: 0, textAlign: 'center', pointerEvents: 'none',
          }}>
            <p style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-body)',
              textShadow: '0 1px 4px rgba(0,0,0,0.8)',
            }}>
              Point at the Plusdine QR code
            </p>
          </div>
        </>
      )}
    </div>
  )
}

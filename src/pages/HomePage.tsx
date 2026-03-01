import { useState } from 'react'
import { QRCodeSVG as QRCode } from 'qrcode.react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../stores/authStore'
import { Logo } from '../components/Logo'
import { Button } from '../components/Button'
import { Input } from '../components/Input'

type Tab = 'wallet' | 'locations' | 'transactions' | 'order'

const TABS: { id: Tab; label: string; comingSoon?: boolean }[] = [
  { id: 'wallet',       label: 'Wallet' },
  { id: 'locations',    label: 'Locations' },
  { id: 'transactions', label: 'History' },
  { id: 'order',        label: 'Order', comingSoon: true },
]

export function HomePage() {
  const { customerProfile, savedLocations, signOut } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('wallet')

  if (!customerProfile) return null

  const displayName = `${customerProfile.first_name ?? ''} ${customerProfile.last_name ?? ''}`.trim()
  const initials = `${(customerProfile.first_name?.[0] ?? '?').toUpperCase()}${(customerProfile.last_name?.[0] ?? '').toUpperCase()}`
  const homeLocation = savedLocations.find(sl => sl.is_home)

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--pd-off-white)',
      maxWidth: 480,
      margin: '0 auto',
    }}>
      {/* Header — respects safe area top (notch/Dynamic Island) */}
      <header style={{
        background: 'var(--pd-green-dark)',
        paddingTop: 'calc(var(--safe-top) + 14px)',
        paddingBottom: '14px',
        paddingLeft: 'var(--page-px)',
        paddingRight: 'var(--page-px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Logo size="sm" variant="light" />
        <button
          onClick={() => signOut()}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, padding: 4,
          }}
          aria-label="Sign out"
        >
          <div style={{
            width: 40, height: 40,
            background: 'var(--pd-yellow)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 'var(--text-sm)',
            color: 'var(--pd-green-dark)',
          }}>
            {initials}
          </div>
        </button>
      </header>

      {/* Balance banner */}
      <div style={{
        background: 'var(--pd-green-dark)',
        paddingLeft: 'var(--page-px)',
        paddingRight: 'var(--page-px)',
        paddingBottom: 'var(--space-lg)',
      }}>
        <div style={{
          background: 'var(--pd-green-mid)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-lg)',
          border: '1px solid rgba(232,242,42,0.12)',
        }}>
          <p style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.45)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}>
            Account balance
          </p>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: '52px',
            color: '#fff',
            lineHeight: 1,
            marginBottom: 8,
          }}>
            ${customerProfile.balance.toFixed(2)}
          </p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.45)' }}>
            {displayName}
            {homeLocation && (
              <span style={{ marginLeft: 8, color: 'var(--pd-yellow)' }}>
                · {homeLocation.location.name}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        background: 'var(--pd-white)',
        borderBottom: '1px solid var(--pd-gray-light)',
        paddingLeft: 'var(--space-sm)',
        paddingRight: 'var(--space-sm)',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              paddingTop: 14,
              paddingBottom: 14,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id
                ? '2.5px solid var(--pd-green)'
                : '2.5px solid transparent',
              cursor: 'pointer',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-body)',
              fontWeight: 500,
              color: activeTab === tab.id ? 'var(--pd-green)' : 'var(--pd-text-muted)',
              transition: 'all 0.15s ease',
              position: 'relative',
            }}
          >
            {tab.label}
            {tab.comingSoon && (
              <span style={{
                position: 'absolute', top: 8, right: 6,
                width: 6, height: 6,
                background: 'var(--pd-yellow)',
                borderRadius: '50%',
              }} />
            )}
          </button>
        ))}
      </div>

      {/* Tab content — safe area bottom padding */}
      <div style={{
        flex: 1,
        padding: 'var(--space-lg) var(--page-px)',
        paddingBottom: 'calc(var(--safe-bottom) + var(--space-lg))',
        overflow: 'auto',
      }}>
        {activeTab === 'wallet'       && <WalletTab customerProfile={customerProfile} />}
        {activeTab === 'locations'    && <LocationsTab />}
        {activeTab === 'transactions' && <TransactionsTab />}
        {activeTab === 'order'        && <ComingSoonTab label="Order ahead" emoji="🛒" description="Place orders and skip the line." />}
      </div>
    </div>
  )
}

// ─── Wallet Tab ───────────────────────────────────────────────────────────────

function WalletTab({ customerProfile }: { customerProfile: { qr_token: string | null } }) {
  const token = customerProfile.qr_token ?? ''
  const { savedLocations } = useAuthStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-lg)' }}>
      {savedLocations.length === 0 && (
        <div className="animate-fade-up" style={{
          width: '100%',
          padding: 'var(--space-md)',
          background: 'rgba(20,90,16,0.07)',
          border: '1px solid rgba(20,90,16,0.15)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--pd-green)', fontWeight: 600, marginBottom: 4 }}>
            No location connected yet
          </p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--pd-text-muted)' }}>
            Go to Locations to connect to a café.
          </p>
        </div>
      )}

      <div className="animate-fade-up" style={{ width: '100%' }}>
        <p style={{
          textAlign: 'center',
          fontSize: 'var(--text-sm)',
          color: 'var(--pd-text-muted)',
          marginBottom: 'var(--space-md)',
        }}>
          Show this code at the kiosk to pay
        </p>
        <div style={{
          background: 'var(--pd-white)',
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-lg)',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-md)',
          border: '1px solid var(--pd-gray-light)',
          animation: 'pulse-green 3s ease-in-out infinite',
        }}>
          {token ? (
            <QRCode value={token} size={220} level="M" includeMargin={false} />
          ) : (
            <div style={{
              width: 220, height: 220,
              background: 'var(--pd-gray-light)',
              borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--pd-text-muted)', fontSize: 'var(--text-sm)',
            }}>
              Generating…
            </div>
          )}
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--pd-text-muted)', marginBottom: 4 }}>
              Member ID
            </p>
            <p style={{
              fontFamily: 'monospace',
              fontSize: 'var(--text-sm)',
              color: 'var(--pd-gray)',
              letterSpacing: '0.1em',
            }}>
              {token.slice(0,4)} {token.slice(4,8)} {token.slice(8,12)} {token.slice(12)}
            </p>
          </div>
        </div>
      </div>

      <div className="animate-fade-up animate-fade-up-delay-1" style={{
        background: 'rgba(20,90,16,0.06)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-md)',
        width: '100%',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--pd-green)', fontWeight: 500 }}>
          💡 Keep your screen bright when scanning
        </p>
      </div>
    </div>
  )
}

// ─── Locations Tab ────────────────────────────────────────────────────────────

function LocationsTab() {
  const { savedLocations, connectLocation, setHomeLocation } = useAuthStore()
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | undefined>()
  const [connecting, setConnecting] = useState(false)

  const handleConnect = async () => {
    if (!code.trim()) { setCodeError('Enter a location code'); return }
    setConnecting(true)
    setCodeError(undefined)
    const { error, locationName } = await connectLocation(code)
    setConnecting(false)
    if (error) {
      setCodeError(error)
    } else {
      setCode('')
      toast.success(`Connected to ${locationName}!`)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>

      {/* Connect a new location */}
      <div className="animate-fade-up">
        <p style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 600,
          color: 'var(--pd-text-muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 'var(--space-md)',
        }}>
          Connect a location
        </p>
        <div style={{
          background: 'var(--pd-white)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-lg)',
          border: '1px solid var(--pd-gray-light)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-md)',
        }}>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--pd-text-muted)', lineHeight: 1.55 }}>
            Scan the QR code at your café, or enter the location code from the menu board or receipt.
          </p>
          <Input
            label="Location code"
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase()); setCodeError(undefined) }}
            error={codeError}
            placeholder="e.g. A3F8C2"
            autoCapitalize="characters"
            autoCorrect="off"
          />
          <Button variant="primary" loading={connecting} onClick={handleConnect}>
            {connecting ? 'Connecting…' : 'Connect'}
          </Button>
        </div>
      </div>

      {/* Saved locations */}
      {savedLocations.length > 0 && (
        <div className="animate-fade-up animate-fade-up-delay-1">
          <p style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--pd-text-muted)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 'var(--space-md)',
          }}>
            Your locations
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {savedLocations.map(sl => (
              <div key={sl.id} style={{
                background: 'var(--pd-white)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-md) var(--space-lg)',
                border: `1.5px solid ${sl.is_home ? 'var(--pd-green)' : 'var(--pd-gray-light)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--pd-text)' }}>
                      {sl.location.name}
                    </p>
                    {sl.is_home && (
                      <span style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: 700,
                        background: 'var(--pd-yellow)',
                        color: 'var(--pd-green-dark)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                      }}>
                        Home
                      </span>
                    )}
                  </div>
                  {(sl.location.city || sl.location.state) && (
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--pd-text-muted)' }}>
                      {[sl.location.city, sl.location.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
                {!sl.is_home && (
                  <button
                    onClick={() => setHomeLocation(sl.id).then(({ error }) => {
                      if (error) toast.error(error)
                      else toast.success(`${sl.location.name} set as home`)
                    })}
                    style={{
                      background: 'none',
                      border: '1px solid var(--pd-gray-mid)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '6px 12px',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--pd-text-muted)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    Set home
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {savedLocations.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: 'var(--space-lg)' }}>
          <div style={{ fontSize: '44px', marginBottom: 'var(--space-md)' }}>📍</div>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-2xl)',
            marginBottom: 'var(--space-sm)',
          }}>
            No locations yet
          </p>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--pd-text-muted)' }}>
            Connect to a café above to get started.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────

function TransactionsTab() {
  return (
    <div style={{ textAlign: 'center', paddingTop: 'var(--space-2xl)' }}>
      <div style={{ fontSize: '44px', marginBottom: 'var(--space-md)' }}>📋</div>
      <p style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-2xl)',
        marginBottom: 'var(--space-sm)',
      }}>
        No transactions yet
      </p>
      <p style={{ fontSize: 'var(--text-base)', color: 'var(--pd-text-muted)' }}>
        Your purchase history will appear here.
      </p>
    </div>
  )
}

function ComingSoonTab({ label, emoji, description }: { label: string; emoji: string; description: string }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 'var(--space-2xl)' }}>
      <div style={{
        width: 72, height: 72,
        background: 'var(--pd-yellow)',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '32px',
        margin: '0 auto var(--space-lg)',
      }}>
        {emoji}
      </div>
      <p style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'var(--text-2xl)',
        marginBottom: 'var(--space-sm)',
      }}>
        {label}
      </p>
      <p style={{ fontSize: 'var(--text-base)', color: 'var(--pd-text-muted)', lineHeight: 1.55 }}>
        {description}
      </p>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { QRCodeSVG as QRCode } from 'qrcode.react'
import toast from 'react-hot-toast'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import { stripePromise } from '../lib/stripe'
import { Logo } from '../components/Logo'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { QrScanner } from '../components/QrScanner'

type Tab = 'wallet' | 'locations' | 'transactions' | 'order'

const TABS: { id: Tab; label: string }[] = [
  { id: 'wallet',       label: 'Wallet'    },
  { id: 'locations',    label: 'Locations' },
  { id: 'transactions', label: 'History'   },
  { id: 'order',        label: 'Orders'    },
]

const PRESET_AMOUNTS = [10, 25, 50, 100]

export function HomePage() {
  const { customerProfile, savedLocations, signOut, fetchSavedLocations } = useAuthStore()
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const initialTab     = (searchParams.get('tab') as Tab) ?? 'wallet'
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && customerProfile) {
        fetchSavedLocations(customerProfile.id)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [customerProfile])

  if (!customerProfile) return null

  const displayName  = `${customerProfile.first_name ?? ''} ${customerProfile.last_name ?? ''}`.trim()
  const initials     = `${(customerProfile.first_name?.[0] ?? '?').toUpperCase()}${(customerProfile.last_name?.[0] ?? '').toUpperCase()}`
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
      {/* Header */}
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
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{
        flex: 1,
        padding: 'var(--space-lg) var(--page-px)',
        paddingBottom: 'calc(var(--safe-bottom) + var(--space-lg))',
        overflow: 'auto',
      }}>
        {activeTab === 'wallet'       && <WalletTab customerProfile={customerProfile} />}
        {activeTab === 'locations'    && <LocationsTab />}
        {activeTab === 'transactions' && <TransactionsTab />}
        {activeTab === 'order'        && <OrdersTab />}
      </div>
    </div>
  )
}

// ─── Wallet Tab ───────────────────────────────────────────────────────────────

function WalletTab({ customerProfile }: { customerProfile: any }) {
  const token = customerProfile.qr_token ?? ''
  const { savedLocations } = useAuthStore()
  const [showTopUp, setShowTopUp] = useState(false)

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

      {/* Add funds button */}
      <div className="animate-fade-up" style={{ width: '100%' }}>
        <button
          onClick={() => setShowTopUp(true)}
          style={{
            width: '100%',
            padding: '14px',
            background: 'var(--pd-yellow)',
            color: 'var(--pd-green-dark)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-base)',
            fontWeight: 700,
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: '18px' }}>＋</span> Add Funds
        </button>
      </div>

      {/* QR code */}
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

      {/* Top-up bottom sheet */}
      {showTopUp && (
        <TopUpSheet
          customerId={customerProfile.id}
          onClose={() => setShowTopUp(false)}
        />
      )}
    </div>
  )
}

// ─── Top-Up Sheet ─────────────────────────────────────────────────────────────

type TopUpStep = 'amount' | 'payment' | 'success'

function TopUpSheet({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const [step, setStep]               = useState<TopUpStep>('amount')
  const [selectedAmount, setSelected] = useState<number | null>(null)
  const [customAmount, setCustom]     = useState('')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const resolvedAmount = selectedAmount ?? parseFloat(customAmount || '0')

  const handleContinue = async () => {
    if (!resolvedAmount || resolvedAmount < 1) {
      setError('Please enter an amount of at least $1.00')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-intent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ customer_id: customerId, amount: resolvedAmount }),
        }
      )
      const json = await res.json()
      if (!json.client_secret) throw new Error(json.error ?? 'Failed to create payment')
      setClientSecret(json.client_secret)
      setPaymentIntentId(json.payment_intent_id)
      setStep('payment')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'rgba(0,0,0,0.5)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 480,
        zIndex: 50,
        background: 'var(--pd-white)',
        borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
        padding: 'var(--space-lg) var(--page-px)',
        paddingBottom: 'calc(var(--safe-bottom) + var(--space-xl))',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.18)',
      }}>
        {/* Handle */}
        <div style={{
          width: 40, height: 4,
          background: 'var(--pd-gray-light)',
          borderRadius: 'var(--radius-full)',
          margin: '0 auto var(--space-lg)',
        }} />

        {step === 'amount' && (
          <AmountStep
            selectedAmount={selectedAmount}
            customAmount={customAmount}
            error={error}
            loading={loading}
            onSelectAmount={(amt) => { setSelected(amt); setCustom('') }}
            onCustomAmount={(val) => { setCustom(val); setSelected(null) }}
            onContinue={handleContinue}
            onClose={onClose}
          />
        )}

        {step === 'payment' && clientSecret && paymentIntentId && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: 'stripe',
                variables: {
                  colorPrimary: '#145a10',
                  colorBackground: '#ffffff',
                  borderRadius: '8px',
                  fontFamily: 'system-ui, sans-serif',
                },
              },
            }}
          >
            <PaymentStep
              amount={resolvedAmount}
              customerId={customerId}
              paymentIntentId={paymentIntentId}
              onSuccess={() => setStep('success')}
              onBack={() => setStep('amount')}
            />
          </Elements>
        )}

        {step === 'success' && (
          <SuccessStep amount={resolvedAmount} onClose={onClose} />
        )}
      </div>
    </>
  )
}

// ─── Amount Step ──────────────────────────────────────────────────────────────

function AmountStep({
  selectedAmount,
  customAmount,
  error,
  loading,
  onSelectAmount,
  onCustomAmount,
  onContinue,
  onClose,
}: {
  selectedAmount: number | null
  customAmount: string
  error: string | null
  loading: boolean
  onSelectAmount: (n: number) => void
  onCustomAmount: (s: string) => void
  onContinue: () => void
  onClose: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)' }}>
          Add Funds
        </h2>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '22px', color: 'var(--pd-text-muted)', padding: 4,
          }}
        >
          ✕
        </button>
      </div>

      {/* Preset amounts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-sm)' }}>
        {PRESET_AMOUNTS.map(amt => (
          <button
            key={amt}
            onClick={() => onSelectAmount(amt)}
            style={{
              padding: '14px 0',
              background: selectedAmount === amt ? 'var(--pd-green-dark)' : 'var(--pd-white)',
              color: selectedAmount === amt ? '#fff' : 'var(--pd-text)',
              border: `1.5px solid ${selectedAmount === amt ? 'var(--pd-green-dark)' : 'var(--pd-gray-light)'}`,
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--text-base)',
              fontWeight: 700,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            ${amt}
          </button>
        ))}
      </div>

      {/* Custom amount */}
      <div>
        <label style={{
          display: 'block',
          fontSize: 'var(--text-xs)',
          fontWeight: 600,
          color: 'var(--pd-text-muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}>
          Or enter amount
        </label>
        <div style={{ position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            fontSize: 'var(--text-base)', color: 'var(--pd-text-muted)', fontWeight: 600,
          }}>
            $
          </span>
          <input
            type="number"
            min="1"
            step="1"
            value={customAmount}
            onChange={e => onCustomAmount(e.target.value)}
            placeholder="0.00"
            style={{
              width: '100%',
              paddingLeft: 28,
              paddingRight: 14,
              paddingTop: 14,
              paddingBottom: 14,
              fontSize: 'var(--text-base)',
              fontFamily: 'var(--font-body)',
              border: `1.5px solid ${customAmount ? 'var(--pd-green)' : 'var(--pd-gray-light)'}`,
              borderRadius: 'var(--radius-md)',
              background: 'var(--pd-white)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {error && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--pd-red)', textAlign: 'center' }}>
          {error}
        </p>
      )}

      <Button variant="primary" loading={loading} onClick={onContinue}>
        {loading ? 'Preparing…' : `Continue${selectedAmount || customAmount ? ` · $${(selectedAmount ?? parseFloat(customAmount || '0')).toFixed(2)}` : ''}`}
      </Button>
    </div>
  )
}

// ─── Payment Step ─────────────────────────────────────────────────────────────

function PaymentStep({
  amount,
  customerId,
  paymentIntentId,
  onSuccess,
  onBack,
}: {
  amount: number
  customerId: string
  paymentIntentId: string
  onSuccess: () => void
  onBack: () => void
}) {
  const stripe   = useStripe()
  const elements = useElements()
  const { fetchCustomerProfile, user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!stripe || !elements) return
    setLoading(true)
    setError(null)

    // Confirm payment with Stripe
    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    })

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed')
      setLoading(false)
      return
    }

    if (paymentIntent?.status !== 'succeeded') {
      setError('Payment did not complete. Please try again.')
      setLoading(false)
      return
    }

    // Record in ledger via wallet-topup
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wallet-topup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            customer_id:       customerId,
            amount,
            source:            'app_card',
            payment_intent_id: paymentIntentId,
          }),
        }
      )
      const json = await res.json()
      if (!json.success) throw new Error(json.error ?? 'Failed to record top-up')

      // Refresh balance in auth store
      if (user) await fetchCustomerProfile(user.id)
      onSuccess()
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '20px', color: 'var(--pd-text-muted)', padding: 4,
          }}
        >
          ←
        </button>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)' }}>
          Pay ${amount.toFixed(2)}
        </h2>
      </div>

      <PaymentElement />

      {error && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--pd-red)', textAlign: 'center' }}>
          {error}
        </p>
      )}

      <Button variant="primary" loading={loading} onClick={handleSubmit}>
        {loading ? 'Processing…' : `Add $${amount.toFixed(2)} to Wallet`}
      </Button>

      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--pd-text-muted)', textAlign: 'center' }}>
        Secured by Stripe. Your card details are never stored by Plusdine.
      </p>
    </div>
  )
}

// ─── Success Step ─────────────────────────────────────────────────────────────

function SuccessStep({ amount, onClose }: { amount: number; onClose: () => void }) {
  useEffect(() => {
    // Auto-close after 3 seconds
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 'var(--space-lg)',
      paddingTop: 'var(--space-md)',
      textAlign: 'center',
    }}>
      <div style={{
        width: 72, height: 72,
        background: 'var(--pd-yellow)',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '32px',
      }}>
        ✓
      </div>
      <div>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', marginBottom: 8 }}>
          ${amount.toFixed(2)} added!
        </p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--pd-text-muted)' }}>
          Your wallet balance has been updated.
        </p>
      </div>
      <Button variant="primary" onClick={onClose}>Done</Button>
    </div>
  )
}

// ─── Locations Tab ────────────────────────────────────────────────────────────

function LocationsTab() {
  const { savedLocations, connectLocation, setHomeLocation, removeLocation } = useAuthStore()
  const navigate = useNavigate()
  const [code, setCode]           = useState('')
  const [codeError, setCodeError] = useState<string | undefined>()
  const [connecting, setConnecting] = useState(false)
  const [scanning, setScanning]   = useState(false)
  const [open, setOpen]           = useState(false)

  const handleConnect = async (tokenOverride?: string) => {
    const token = tokenOverride ?? code
    if (!token.trim()) { setCodeError('Enter a location code'); return }
    setConnecting(true)
    setCodeError(undefined)
    const { error, locationName } = await connectLocation(token)
    setConnecting(false)
    if (error) {
      setCodeError(error)
    } else {
      setCode('')
      toast.success(`Connected to ${locationName}!`)
    }
  }

  const handleScan = (token: string) => {
    setScanning(false)
    handleConnect(token)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>

      {scanning && <QrScanner onScan={handleScan} onClose={() => setScanning(false)} />}

      <div className="animate-fade-up">
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12,
            background: open ? 'var(--pd-green-dark)' : 'var(--pd-green)',
            color: '#fff',
            border: 'none',
            borderRadius: open ? 'var(--radius-md) var(--radius-md) 0 0' : 'var(--radius-md)',
            padding: '14px var(--space-lg)',
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            transition: 'border-radius 0.15s ease, background 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '20px' }}>📍</span>
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>
              Connect a location
            </span>
          </div>
          <span style={{
            fontSize: '18px', lineHeight: 1,
            transform: open ? 'rotate(90deg)' : 'rotate(270deg)',
            transition: 'transform 0.2s ease',
            opacity: 0.8,
            display: 'inline-block',
          }}>
            ›
          </span>
        </button>

        {open && (
          <div style={{
            background: 'var(--pd-white)',
            borderRadius: '0 0 var(--radius-md) var(--radius-md)',
            padding: 'var(--space-lg)',
            border: '1px solid var(--pd-green)',
            borderTop: 'none',
            display: 'flex', flexDirection: 'column', gap: 'var(--space-md)',
          }}>
            <button
              onClick={() => setScanning(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 10, width: '100%',
                background: 'var(--pd-green-dark)', color: '#fff',
                border: 'none', borderRadius: 'var(--radius-md)',
                padding: '16px', cursor: 'pointer',
                fontSize: 'var(--text-base)', fontWeight: 600,
                fontFamily: 'var(--font-body)',
              }}
            >
              <span style={{ fontSize: '22px' }}>📷</span>
              Scan QR code
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--pd-gray-light)' }} />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--pd-text-muted)', fontWeight: 500 }}>
                or enter code
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--pd-gray-light)' }} />
            </div>

            <Input
              label="Location code"
              value={code}
              onChange={e => { setCode(e.target.value.toUpperCase()); setCodeError(undefined) }}
              error={codeError}
              placeholder="e.g. A3F8C2"
              autoCapitalize="characters"
              autoCorrect="off"
            />
            <Button variant="primary" loading={connecting} onClick={() => handleConnect()}>
              {connecting ? 'Connecting…' : 'Connect'}
            </Button>
          </div>
        )}
      </div>

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
              <div
                key={sl.id}
                onClick={() => navigate(`/menu/${sl.location_id}`)}
                style={{
                  background: 'var(--pd-white)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md) var(--space-lg)',
                  border: `1.5px solid ${sl.is_home ? 'var(--pd-green)' : 'var(--pd-gray-light)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
              >
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
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setHomeLocation(sl.id).then(({ error }) => {
                          if (error) toast.error(error)
                          else toast.success(`${sl.location.name} set as home`)
                        })
                      }}
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
                    {savedLocations.length > 1 && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          if (!confirm(`Remove ${sl.location.name}?`)) return
                          removeLocation(sl.id).then(({ error }) => {
                            if (error) toast.error(error)
                            else toast.success(`${sl.location.name} removed`)
                          })
                        }}
                        style={{
                          background: 'none',
                          border: '1px solid var(--pd-gray-mid)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '6px 10px',
                          fontSize: 'var(--text-sm)',
                          color: 'var(--pd-red)',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-body)',
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
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
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-sm)' }}>
        Coming Soon
      </p>
      <p style={{ fontSize: 'var(--text-base)', color: 'var(--pd-text-muted)' }}>
        Transaction history will appear here.
      </p>
    </div>
  )
}

// ─── Orders Tab ───────────────────────────────────────────────────────────────

function OrdersTab() {
  const { customerProfile } = useAuthStore()
  const navigate = useNavigate()
  const [orders, setOrders]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!customerProfile) return
    loadOrders()

    const channel = supabase
      .channel(`remote-orders-app-${customerProfile.id}`)
      .on(
        'postgres_changes' as any,
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'remote_orders',
          filter: `customer_id=eq.${customerProfile.id}`,
        },
        (payload: any) => {
          setOrders(prev => prev.map(o =>
            o.id === payload.new.id ? { ...o, status: payload.new.status } : o
          ))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [customerProfile])

  async function loadOrders() {
    if (!customerProfile) return
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 60)
    const { data } = await supabase
      .from('remote_orders')
      .select(`
        id, order_number, status, pickup_time,
        total_cents, created_at,
        locations ( name ),
        remote_order_items ( product_name, quantity )
      `)
      .eq('customer_id', customerProfile.id)
      .gte('created_at', cutoff.toISOString())
      .order('created_at', { ascending: false })
      .limit(50)

    const orders = (data ?? []).map((o: any) => {
      const seen = new Set<string>()
      const items = (o.remote_order_items ?? []).filter((i: any) => {
        if (seen.has(i.product_name)) return false
        seen.add(i.product_name)
        return true
      })
      return { ...o, remote_order_items: items }
    })
    setOrders(orders)
    setLoading(false)
  }

  const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    pending:   { label: 'Processing',  color: '#92400e', bg: '#fffbeb' },
    confirmed: { label: 'Confirmed',   color: '#166534', bg: '#f0fdf4' },
    active:    { label: 'Being made',  color: '#1e40af', bg: '#eff6ff' },
    completed: { label: 'Ready! ✓',   color: '#166534', bg: '#f0fdf4' },
    cancelled: { label: 'Cancelled',   color: '#991b1b', bg: '#fff1f2' },
  }

  function formatPickupTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  function formatPickupDate(iso: string): string {
    const d        = new Date(iso)
    const today    = new Date()
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    if (d.toDateString() === today.toDateString())    return 'Today'
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
      <div style={{
        width: 28, height: 28,
        border: '2px solid var(--pd-green-light)',
        borderTopColor: 'var(--pd-green)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
    </div>
  )

  if (orders.length === 0) return (
    <div style={{ textAlign: 'center', paddingTop: 'var(--space-2xl)' }}>
      <div style={{ fontSize: 44, marginBottom: 'var(--space-md)' }}>🛒</div>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-sm)' }}>
        No orders yet
      </p>
      <p style={{ fontSize: 'var(--text-base)', color: 'var(--pd-text-muted)' }}>
        Your order history will appear here.
      </p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {orders.map(order => {
        const st = STATUS_LABELS[order.status] ?? { label: order.status, color: 'var(--pd-text-muted)', bg: 'var(--pd-gray-light)' }
        const itemSummary = order.remote_order_items
          .slice(0, 2)
          .map((i: any) => `${i.quantity}× ${i.product_name}`)
          .join(', ') + (order.remote_order_items.length > 2 ? ` +${order.remote_order_items.length - 2} more` : '')

        return (
          <div
            key={order.id}
            onClick={() => navigate(`/order/confirmation?order_id=${order.id}`)}
            style={{
              background: 'var(--pd-white)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--pd-gray-light)',
              padding: 'var(--space-md) var(--space-lg)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                {order.order_number ? `#${order.order_number}` : 'Order'}
                {order.locations && (
                  <span style={{ fontWeight: 400, color: 'var(--pd-text-muted)', marginLeft: 6 }}>
                    · {order.locations.name}
                  </span>
                )}
              </p>
              <span style={{
                fontSize: 'var(--text-xs)', fontWeight: 600,
                color: st.color, background: st.bg,
                padding: '3px 8px', borderRadius: 'var(--radius-sm)',
              }}>
                {st.label}
              </span>
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--pd-text-muted)' }}>{itemSummary}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--pd-text-muted)' }}>
                {formatPickupDate(order.pickup_time)} · {formatPickupTime(order.pickup_time)}
              </p>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                ${(order.total_cents / 100).toFixed(2)}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

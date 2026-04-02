import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { supabase } from '../lib/supabase'
import { stripePromise } from '../lib/stripe'
import { useCartStore } from '../stores/cartStore'
import { useAuthStore } from '../stores/authStore'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Slot {
  start_time:   string
  end_time:     string
  max_capacity: number
  booked:       number
  available:    number
  is_full:      boolean
}

interface TaxRate {
  rate_pct:   number
  applies_to: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function formatTime(t: string): string {
  if (!t) return ''
  let h: number, m: number
  if (typeof t === 'string' && t.includes(':')) {
    const parts = t.split(':').map(Number)
    h = parts[0]; m = parts[1]
  } else {
    const mins = Number(t)
    if (isNaN(mins)) return t
    h = Math.floor(mins / 60); m = mins % 60
  }
  if (isNaN(h) || isNaN(m)) return t
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12  = h % 12 || 12
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, '0')}${ampm}`
}

function getTodayDateStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function normalizeSlotTime(t: string | number): string {
  let h: number, m: number
  if (typeof t === 'number') {
    h = Math.floor(t / 60); m = t % 60
  } else if (typeof t === 'string' && t.includes(':')) {
    const parts = t.split(':').map(Number)
    h = parts[0]; m = parts[1]
  } else {
    const mins = Number(t)
    h = Math.floor(mins / 60); m = mins % 60
  }
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function slotToMinutes(t: string): number {
  if (t.includes(':')) {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  return Number(t)
}

function buildScheduledAt(dateStr: string, slotStart: string): string {
  return new Date(`${dateStr}T${slotStart}:00`).toISOString()
}

// ─── Stripe appearance — matches Plusdine colour palette ──────────────────────

const stripeAppearance = {
  theme: 'stripe' as const,
  variables: {
    colorPrimary:        '#166534',   // --pd-green-dark
    colorBackground:     '#ffffff',
    colorText:           '#111827',
    colorDanger:         '#b91c1c',
    fontFamily:          'system-ui, sans-serif',
    borderRadius:        '8px',
    spacingUnit:         '4px',
  },
  rules: {
    '.Label':       { fontWeight: '600', color: '#374151' },
    '.Input':       { border: '1.5px solid #d1d5db', padding: '10px 12px' },
    '.Input:focus': { border: '1.5px solid #166534', boxShadow: '0 0 0 2px rgba(22,101,52,0.15)' },
  },
}

// ─── PaymentForm — inner component, must be child of <Elements> ───────────────

interface PaymentFormProps {
  orderId:     string
  totalCents:  number
  pickupTime:  string
  onSuccess:   (orderId: string) => void
  onCancel:    () => void
}

function PaymentForm({ orderId, totalCents, pickupTime, onSuccess, onCancel }: PaymentFormProps) {
  const stripe   = useStripe()
  const elements = useElements()

  const [paying,   setPaying]   = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  async function handlePay() {
    if (!stripe || !elements) return
    setPayError(null)
    setPaying(true)

    // Validate the PaymentElement fields before submitting
    const { error: submitError } = await elements.submit()
    if (submitError) {
      setPayError(submitError.message ?? 'Please check your payment details.')
      setPaying(false)
      return
    }

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Stripe redirects here for payment methods that require a redirect (e.g. 3DS).
        // For standard card payments, redirect: 'if_required' prevents the redirect.
        return_url: `${window.location.origin}/order-confirmation?order_id=${orderId}`,
      },
      redirect: 'if_required',
    })

    console.log('[Payment] error:', error)
    console.log('[Payment] paymentIntent:', paymentIntent)
    console.log('[Payment] status:', paymentIntent?.status)

    if (error) {
      // Card declined, insufficient funds, 3DS failed, etc.
      setPayError(error.message ?? 'Payment failed. Please try a different card.')
      setPaying(false)
      return
    }

    if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
      // Success — the webhook will confirm server-side; navigate to confirmation
      onSuccess(orderId)
    } else {
      setPayError('Payment did not complete. Please try again.')
      setPaying(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

      {/* Order summary recap */}
      <div style={{
        background:    'var(--pd-white)',
        borderRadius:  'var(--radius-md)',
        border:        '1px solid var(--pd-gray-light)',
        padding:       'var(--space-md) var(--space-lg)',
        display:       'flex',
        justifyContent:'space-between',
        alignItems:    'center',
      }}>
        <div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--pd-text-muted)' }}>Pickup</p>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>{formatTime(pickupTime)}</p>
        </div>
        <p style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--pd-green-dark)' }}>
          {formatCents(totalCents)}
        </p>
      </div>

      {/* Stripe PaymentElement */}
      <div style={{
        background:   'var(--pd-white)',
        borderRadius: 'var(--radius-md)',
        border:       '1px solid var(--pd-gray-light)',
        padding:      'var(--space-lg)',
      }}>
        <p style={{
          fontSize:      'var(--text-xs)',
          fontWeight:    600,
          color:         'var(--pd-text-muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom:  'var(--space-md)',
        }}>
          Payment
        </p>
        <PaymentElement
          options={{
            layout: { type: 'tabs', defaultCollapsed: false },
          }}
        />
      </div>

      {/* Error */}
      {payError && (
        <div style={{
          background:   '#fff0ef',
          border:       '1px solid #fca5a5',
          borderRadius: 'var(--radius-md)',
          padding:      'var(--space-md)',
          fontSize:     'var(--text-sm)',
          color:        '#b91c1c',
        }}>
          {payError}
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        <button
          onClick={handlePay}
          disabled={!stripe || paying}
          style={{
            width:        '100%',
            background:   (!stripe || paying) ? 'var(--pd-gray-mid)' : 'var(--pd-yellow)',
            color:        (!stripe || paying) ? 'var(--pd-gray)' : 'var(--pd-green-dark)',
            border:       'none',
            borderRadius: 'var(--radius-md)',
            padding:      18,
            fontSize:     'var(--text-base)',
            fontWeight:   700,
            fontFamily:   'var(--font-body)',
            cursor:       (!stripe || paying) ? 'not-allowed' : 'pointer',
            opacity:      paying ? 0.7 : 1,
            transition:   'all 0.15s ease',
          }}
        >
          {paying ? 'Processing…' : `Pay ${formatCents(totalCents)}`}
        </button>

        <button
          onClick={onCancel}
          disabled={paying}
          style={{
            width:        '100%',
            background:   'transparent',
            color:        'var(--pd-text-muted)',
            border:       '1.5px solid var(--pd-gray-light)',
            borderRadius: 'var(--radius-md)',
            padding:      14,
            fontSize:     'var(--text-sm)',
            fontWeight:   600,
            fontFamily:   'var(--font-body)',
            cursor:       paying ? 'not-allowed' : 'pointer',
          }}
        >
          ← Back to cart
        </button>
      </div>

      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--pd-text-muted)', textAlign: 'center' }}>
        Payments are secure and encrypted
      </p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function CartPage() {
  const navigate = useNavigate()
  const { customerProfile, savedLocations, session } = useAuthStore()
  const { items, locationId, menuId, removeItem, updateQty, clearCart, subtotalCents } = useCartStore()

  // ── Cart / slot state ──────────────────────────────────────────────────────
  const [slots,         setSlots]         = useState<Slot[]>([])
  const [selectedSlot,  setSelectedSlot]  = useState<string | null>(null)
  const [taxRates,      setTaxRates]      = useState<TaxRate[]>([])
  const [slotsLoading,  setSlotsLoading]  = useState(false)
  const [leadTimeMins,  setLeadTimeMins]  = useState(15)

  // ── Checkout state ─────────────────────────────────────────────────────────
  // 'cart'      — cart review + slot picker
  // 'preparing' — edge function in-flight (creating order + PaymentIntent)
  // 'payment'   — Stripe PaymentElement shown
  const [checkoutStep,  setCheckoutStep]  = useState<'cart' | 'preparing' | 'payment'>('cart')
  const [clientSecret,  setClientSecret]  = useState<string | null>(null)
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const location   = savedLocations.find(sl => sl.location_id === locationId)?.location
  const subtotal   = subtotalCents()
  const taxRatePct = taxRates.filter(r => r.applies_to === 'all' || r.applies_to === 'food')
                              .reduce((s, r) => s + Number(r.rate_pct), 0)
  const taxCents   = Math.round(subtotal * taxRatePct / 100)
  const totalCents = subtotal + taxCents
  const today      = getTodayDateStr()

  useEffect(() => {
    if (!locationId) return
    loadSlotsAndTax()
  }, [locationId])

  async function loadSlotsAndTax() {
    if (!locationId) return
    setSlotsLoading(true)

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const tzOffset    = new Date().getTimezoneOffset()

    const [slotsRes, taxRes, leadTimeRes] = await Promise.all([
      fetch(
        `${supabaseUrl}/functions/v1/get-available-slots?location_id=${locationId}&date=${today}&tz_offset=${tzOffset}`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      ).then(r => r.json()).catch(() => ({ slots: [] })),
      supabase
        .from('tax_rates')
        .select('rate_pct, applies_to')
        .eq('location_id', locationId)
        .eq('is_active', true),
      supabase
        .from('settings')
        .select('value')
        .eq('location_id', locationId)
        .eq('key', 'remote_order_lead_time_minutes')
        .maybeSingle(),
    ])

    const configuredLeadTime = (leadTimeRes?.data as any)?.value ?? 15
    const leadTime = Math.max(1, Number(configuredLeadTime)) + 2
    setLeadTimeMins(leadTime)

    const now       = new Date()
    const nowMins   = now.getHours() * 60 + now.getMinutes() + leadTime
    const available = (slotsRes.slots ?? [])
      .filter((s: Slot) => !s.is_full)
      .map((s: Slot) => ({
        ...s,
        start_time: normalizeSlotTime(s.start_time as any),
        end_time:   normalizeSlotTime(s.end_time as any),
      }))
      .filter((s: Slot) => slotToMinutes(s.start_time) >= nowMins)

    setSlots(available)
    setTaxRates((taxRes.data ?? []) as TaxRate[])
    setSlotsLoading(false)
  }

  // ── Step 1: validate slot + call create-remote-order ──────────────────────
  async function handleProceedToPayment() {
    if (!selectedSlot || !locationId || !menuId || !customerProfile) return
    setCheckoutError(null)

    // Re-validate the slot hasn't aged past the lead time threshold
    const nowMinsCheck = new Date().getHours() * 60 + new Date().getMinutes() + leadTimeMins
    if (slotToMinutes(selectedSlot) < nowMinsCheck) {
      setCheckoutError("That pickup time is no longer available — it's too soon. Please select a later time.")
      setSelectedSlot(null)
      loadSlotsAndTax()
      return
    }

    const accessToken = session?.access_token ?? null
    if (!accessToken) {
      setCheckoutError('Your session has expired. Please sign out and sign in again.')
      return
    }

    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]))
      if ((payload.exp ?? 0) * 1000 < Date.now() + 30_000) {
        setCheckoutError('Your session has expired. Please sign out and sign in again to place your order.')
        return
      }
    } catch { /* proceed */ }

    setCheckoutStep('preparing')

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
    const scheduledAt = buildScheduledAt(today, selectedSlot)

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/create-remote-order`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        supabaseKey,
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          location_id:   locationId,
          menu_id:       menuId,
          pickup_slot:   selectedSlot,
          pickup_date:   today,
          scheduled_at:  scheduledAt,
          customer_name: `${customerProfile.first_name ?? ''} ${customerProfile.last_name ?? ''}`.trim(),
          items: items.map(i => ({
            menu_item_id:  i.menu_item_id,
            product_name:  i.product_name,
            quantity:      i.quantity,
            unit_price:    i.unit_price,
            modifiers:     i.modifiers,
          })),
        }),
      })

      const data = await res.json()

      if (res.status === 401) {
        setCheckoutError('Your session has expired. Please sign out and sign in again.')
        setCheckoutStep('cart')
        return
      }
      if (!res.ok) {
        setCheckoutError(data.error ?? 'Could not start checkout. Please try again.')
        setCheckoutStep('cart')
        return
      }

      // Edge function returns { order_id, client_secret }
      setClientSecret(data.client_secret)
      setPendingOrderId(data.order_id)
      setCheckoutStep('payment')

    } catch {
      setCheckoutError('Network error. Please check your connection and try again.')
      setCheckoutStep('cart')
    }
  }

  // ── Step 2: Stripe confirmed payment ──────────────────────────────────────
  function handlePaymentSuccess(orderId: string) {
    navigate(`/order-confirmation?order_id=${orderId}`)
    clearCart()
  }

  // ── Back button from payment step ─────────────────────────────────────────
  // Note: we can't reuse the PaymentIntent after going back — the next attempt
  // will create a new order + PI. The abandoned 'unpaid' order will be cleaned
  // up by a scheduled maintenance job (to be added later).
  function handleBackToCart() {
    setCheckoutStep('cart')
    setClientSecret(null)
    setPendingOrderId(null)
    setCheckoutError(null)
  }

  // ─── Empty cart guard ──────────────────────────────────────────────────────
  // Don't show while we're mid-checkout (preparing or payment step) because the
  // cart clears on success and we don't want to flicker to the empty screen.
  if (items.length === 0 && checkoutStep === 'cart') {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        background: 'var(--pd-off-white)', maxWidth: 480, margin: '0 auto',
      }}>
        <header style={{
          background: 'var(--pd-green-dark)',
          paddingTop: 'calc(var(--safe-top) + 14px)',
          paddingBottom: 14,
          paddingLeft: 'var(--page-px)', paddingRight: 'var(--page-px)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 22 }}>←</button>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 'var(--text-base)' }}>Your Cart</p>
        </header>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--page-px)', textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 'var(--space-md)' }}>🛒</div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', marginBottom: 8 }}>Cart is empty</p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--pd-text-muted)', marginBottom: 'var(--space-lg)' }}>Add some items from the menu.</p>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'var(--pd-green-dark)', color: '#fff', border: 'none',
              borderRadius: 'var(--radius-md)', padding: '14px 32px',
              fontSize: 'var(--text-base)', fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer',
            }}
          >
            Browse Menu
          </button>
        </div>
      </div>
    )
  }

  // ─── Payment step ──────────────────────────────────────────────────────────
  if (checkoutStep === 'payment' && clientSecret && pendingOrderId) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        background: 'var(--pd-off-white)', maxWidth: 480, margin: '0 auto',
      }}>
        <header style={{
          background: 'var(--pd-green-dark)',
          paddingTop: 'calc(var(--safe-top) + 14px)',
          paddingBottom: 14,
          paddingLeft: 'var(--page-px)', paddingRight: 'var(--page-px)',
          display: 'flex', alignItems: 'center', gap: 12,
          position: 'sticky', top: 0, zIndex: 20,
        }}>
          <button
            onClick={handleBackToCart}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 22, padding: '4px 0' }}
          >
            ←
          </button>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 'var(--text-base)', flex: 1 }}>
            Payment
          </p>
        </header>

        <div style={{
          flex: 1,
          padding: 'var(--space-lg) var(--page-px)',
          paddingBottom: 'calc(var(--safe-bottom) + var(--space-lg))',
          overflowY: 'auto',
        }}>
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: stripeAppearance,
            }}
          >
            <PaymentForm
              orderId={pendingOrderId}
              totalCents={totalCents}
              pickupTime={selectedSlot!}
              onSuccess={handlePaymentSuccess}
              onCancel={handleBackToCart}
            />
          </Elements>
        </div>
      </div>
    )
  }

  // ─── Cart step (default) ───────────────────────────────────────────────────
  const isPreparing = checkoutStep === 'preparing'

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      background: 'var(--pd-off-white)', maxWidth: 480, margin: '0 auto',
    }}>

      {/* Header */}
      <header style={{
        background: 'var(--pd-green-dark)',
        paddingTop: 'calc(var(--safe-top) + 14px)',
        paddingBottom: 14,
        paddingLeft: 'var(--page-px)', paddingRight: 'var(--page-px)',
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 22, padding: '4px 0' }}
        >
          ←
        </button>
        <p style={{ color: '#fff', fontWeight: 700, fontSize: 'var(--text-base)', flex: 1 }}>
          Your Cart {location ? `· ${location.name}` : ''}
        </p>
      </header>

      <div style={{
        flex: 1,
        padding: 'var(--space-lg) var(--page-px)',
        paddingBottom: 'calc(var(--safe-bottom) + 100px)',
        display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)',
        overflowY: 'auto',
      }}>

        {/* Cart items */}
        <div>
          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--pd-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-md)' }}>
            Items
          </p>
          <div style={{ background: 'var(--pd-white)', borderRadius: 'var(--radius-md)', border: '1px solid var(--pd-gray-light)', overflow: 'hidden' }}>
            {items.map((item, idx) => (
              <div key={item.menu_item_id} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-md)',
                padding: 'var(--space-md) var(--space-lg)',
                borderTop: idx > 0 ? '1px solid var(--pd-gray-light)' : 'none',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--pd-text)' }}>{item.product_name}</p>
                  {item.modifiers.length > 0 && (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--pd-text-muted)', marginTop: 2 }}>
                      {item.modifiers.map((m: any) => m.name).join(', ')}
                    </p>
                  )}
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--pd-text-muted)', marginTop: 2 }}>
                    {formatCents(item.unit_price)} each
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => updateQty(item.menu_item_id, item.quantity - 1)}
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      border: '1.5px solid var(--pd-gray-mid)',
                      background: 'none', cursor: 'pointer',
                      fontSize: 18, color: 'var(--pd-text)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >−</button>
                  <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, minWidth: 20, textAlign: 'center' }}>
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQty(item.menu_item_id, item.quantity + 1)}
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      border: '1.5px solid var(--pd-gray-mid)',
                      background: 'none', cursor: 'pointer',
                      fontSize: 18, color: 'var(--pd-text)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >+</button>
                </div>
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, minWidth: 52, textAlign: 'right', flexShrink: 0 }}>
                  {formatCents((item.unit_price + item.modifiers.reduce((s: number, m: any) => s + m.price_delta, 0)) * item.quantity)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Pickup slot picker */}
        <div>
          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--pd-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-md)' }}>
            Pickup Time — {today}
          </p>
          {slotsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <div style={{ width: 24, height: 24, border: '2px solid var(--pd-green-light)', borderTopColor: 'var(--pd-green)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            </div>
          ) : slots.length === 0 ? (
            <div style={{ background: 'var(--pd-white)', borderRadius: 'var(--radius-md)', border: '1px solid var(--pd-gray-light)', padding: 'var(--space-lg)', textAlign: 'center' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--pd-text-muted)' }}>
                No pickup slots available today. Please check back later.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {slots.map(slot => (
                <button
                  key={slot.start_time}
                  onClick={() => setSelectedSlot(slot.start_time)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px',
                    background: selectedSlot === slot.start_time ? 'var(--pd-green-dark)' : 'var(--pd-white)',
                    color: selectedSlot === slot.start_time ? '#fff' : 'var(--pd-text)',
                    border: `1.5px solid ${selectedSlot === slot.start_time ? 'var(--pd-green-dark)' : 'var(--pd-gray-light)'}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer', fontFamily: 'var(--font-body)',
                    transition: 'all 0.15s ease', width: '100%',
                  }}
                >
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    {formatTime(slot.start_time)}
                    {slot.end_time ? ` – ${formatTime(slot.end_time)}` : ''}
                  </span>
                  <span style={{
                    fontSize: 'var(--text-xs)', fontWeight: 500,
                    color: selectedSlot === slot.start_time ? 'rgba(255,255,255,0.7)' : 'var(--pd-text-muted)',
                  }}>
                    {slot.available} spot{slot.available !== 1 ? 's' : ''} left
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Order total */}
        <div style={{ background: 'var(--pd-white)', borderRadius: 'var(--radius-md)', border: '1px solid var(--pd-gray-light)', padding: 'var(--space-lg)' }}>
          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--pd-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-md)' }}>
            Order Total
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--pd-text-muted)' }}>Subtotal</span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{formatCents(subtotal)}</span>
            </div>
            {taxCents > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--pd-text-muted)' }}>Tax ({taxRatePct.toFixed(2)}%)</span>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{formatCents(taxCents)}</span>
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--pd-gray-light)', paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Total</span>
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>{formatCents(totalCents)}</span>
            </div>
          </div>
        </div>

        {/* Error */}
        {checkoutError && (
          <div style={{
            background: '#fff0ef', border: '1px solid #fca5a5',
            borderRadius: 'var(--radius-md)', padding: 'var(--space-md)',
            fontSize: 'var(--text-sm)', color: '#b91c1c',
          }}>
            {checkoutError}
          </div>
        )}
      </div>

      {/* Sticky checkout button */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480,
        padding: `var(--space-md) var(--page-px) calc(var(--safe-bottom) + var(--space-md))`,
        background: 'linear-gradient(to top, var(--pd-off-white) 80%, transparent)',
        zIndex: 20,
      }}>
        <button
          onClick={handleProceedToPayment}
          disabled={!selectedSlot || isPreparing}
          style={{
            width: '100%',
            background: selectedSlot ? 'var(--pd-yellow)' : 'var(--pd-gray-mid)',
            color: selectedSlot ? 'var(--pd-green-dark)' : 'var(--pd-gray)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: 18,
            fontSize: 'var(--text-base)',
            fontWeight: 700,
            fontFamily: 'var(--font-body)',
            cursor: selectedSlot ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s ease',
            opacity: isPreparing ? 0.7 : 1,
          }}
        >
          {isPreparing
            ? 'Preparing checkout…'
            : !selectedSlot
              ? 'Select a pickup time'
              : `Continue to payment · ${formatTime(selectedSlot)}`
          }
        </button>
      </div>
    </div>
  )
}

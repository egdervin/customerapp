import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCartStore } from '../stores/cartStore'
import { useAuthStore } from '../stores/authStore'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Slot {
  start_time:   string   // "HH:MM"
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
  // Use local date, NOT toISOString() which is UTC and would give the wrong date
  // for users who are behind UTC (e.g. CDT = UTC-5)
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Normalize a time value (HH:MM, HH:MM:SS, or numeric minutes) to "HH:MM"
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
  // Combine date + slot start time into ISO string (local time)
  return new Date(`${dateStr}T${slotStart}:00`).toISOString()
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function CartPage() {
  const navigate = useNavigate()
  const { customerProfile, savedLocations, session } = useAuthStore()
  const { items, locationId, menuId, removeItem, updateQty, clearCart, subtotalCents } = useCartStore()

  const [slots,         setSlots]         = useState<Slot[]>([])
  const [selectedSlot,  setSelectedSlot]  = useState<string | null>(null)   // "HH:MM"
  const [taxRates,      setTaxRates]      = useState<TaxRate[]>([])
  const [slotsLoading,  setSlotsLoading]  = useState(false)
  const [checkingOut,  setCheckingOut]   = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const location    = savedLocations.find(sl => sl.location_id === locationId)?.location
  const subtotal    = subtotalCents()
  const taxRatePct  = taxRates.filter(r => r.applies_to === 'all' || r.applies_to === 'food')
                               .reduce((s, r) => s + Number(r.rate_pct), 0)
  const taxCents    = Math.round(subtotal * taxRatePct / 100)
  const totalCents  = subtotal + taxCents
  const today       = getTodayDateStr()

  useEffect(() => {
    if (!locationId) return
    loadSlotsAndTax()
  }, [locationId])

  async function loadSlotsAndTax() {
    if (!locationId) return
    setSlotsLoading(true)

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

    // Pass local timezone offset (minutes behind UTC, e.g. CDT = 300) so the
    // edge function can compute "now" in local time rather than UTC
    const tzOffset = new Date().getTimezoneOffset()
    const [slotsRes, taxRes] = await Promise.all([
      fetch(
        `${supabaseUrl}/functions/v1/get-available-slots?location_id=${locationId}&date=${today}&tz_offset=${tzOffset}`,
        { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
      ).then(r => r.json()).catch(() => ({ slots: [] })),
      supabase
        .from('tax_rates')
        .select('rate_pct, applies_to')
        .eq('location_id', locationId)
        .eq('is_active', true),
    ])

    const now       = new Date()
    const nowMins   = now.getHours() * 60 + now.getMinutes() + 15  // must be 15+ min from now
    const available = (slotsRes.slots ?? [])
      .filter((s: Slot) => !s.is_full)
      .map((s: Slot) => ({ ...s, start_time: normalizeSlotTime(s.start_time as any), end_time: normalizeSlotTime(s.end_time as any) }))
      .filter((s: Slot) => slotToMinutes(s.start_time) >= nowMins)
    setSlots(available)
    setTaxRates((taxRes.data ?? []) as TaxRate[])
    setSlotsLoading(false)
  }

  async function handleCheckout() {
    if (!selectedSlot || !locationId || !menuId || !customerProfile) return
    setCheckoutError(null)
    setCheckingOut(true)

    const scheduledAt = buildScheduledAt(today, selectedSlot)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

    // Use the session already held in Zustand — no async storage calls needed.
    const accessToken = session?.access_token ?? null
    console.log('[Checkout] Token from store:', accessToken ? 'present' : 'missing')

    if (!accessToken) {
      setCheckoutError('Your session has expired. Please sign out and sign in again.')
      setCheckingOut(false)
      return
    }

    // Decode JWT expiry without any async calls — JWT payload is just base64
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]))
      const expiresAt = (payload.exp ?? 0) * 1000   // convert to ms
      const nowMs     = Date.now()
      console.log('[Checkout] Token expires at:', new Date(expiresAt).toISOString(), '— now:', new Date(nowMs).toISOString())
      if (expiresAt < nowMs + 30_000) {
        // Expired or expires within 30s — don't even try, prompt re-login
        setCheckoutError('Your session has expired. Please sign out and sign in again to place your order.')
        setCheckingOut(false)
        return
      }
    } catch {
      console.warn('[Checkout] Could not decode JWT — proceeding anyway')
    }

    console.log('[Checkout] Calling edge function…')
    try {
      console.log('[Checkout] Fetching create-remote-order…')
      const res = await fetch(`${supabaseUrl}/functions/v1/create-remote-order`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
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

      console.log('[Checkout] Edge function responded:', res.status)
      const data = await res.json()

      if (res.status === 401) {
        setCheckoutError('Your session has expired. Please sign out and sign in again to place your order.')
        setCheckingOut(false)
        return
      }

      if (!res.ok) {
        setCheckoutError(data.error ?? 'Checkout failed. Please try again.')
        setCheckingOut(false)
        return
      }

      const checkoutUrl = data.checkout_url || data.long_url
      console.log('[Plusdine] Square checkout URL:', checkoutUrl)

      if (!checkoutUrl) {
        setCheckoutError('Payment link unavailable. Please try again.')
        setCheckingOut(false)
        return
      }

      // Clear cart then redirect to Square.
      // Use window.open so PWA scope restrictions don't block the navigation.
      clearCart()
      const opened = window.open(checkoutUrl, '_blank')
      if (!opened) {
        // Popup was blocked — fall back to same-tab navigation
        window.location.assign(checkoutUrl)
      }
      // Reset button in case user returns to this tab (e.g. opened in new tab)
      setTimeout(() => setCheckingOut(false), 3000)

    } catch (e) {
      setCheckoutError('Network error. Please check your connection and try again.')
      setCheckingOut(false)
    }
  }

  if (items.length === 0) {
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
                      {item.modifiers.map(m => m.name).join(', ')}
                    </p>
                  )}
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--pd-text-muted)', marginTop: 2 }}>
                    {formatCents(item.unit_price)} each
                  </p>
                </div>
                {/* Qty controls */}
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
                  >
                    −
                  </button>
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
                  >
                    +
                  </button>
                </div>
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 700, minWidth: 52, textAlign: 'right', flexShrink: 0 }}>
                  {formatCents((item.unit_price + item.modifiers.reduce((s, m) => s + m.price_delta, 0)) * item.quantity)}
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
          onClick={handleCheckout}
          disabled={!selectedSlot || checkingOut}
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
            opacity: checkingOut ? 0.7 : 1,
          }}
        >
          {checkingOut
            ? 'Opening payment…'
            : !selectedSlot
              ? 'Select a pickup time'
              : `Pay ${formatCents(totalCents)} · ${formatTime(selectedSlot)} pickup`
          }
        </button>
      </div>
    </div>
  )
}

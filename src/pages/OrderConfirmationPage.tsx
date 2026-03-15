import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface OrderDetail {
  id:             string
  order_number:   string
  state:          string
  pickup_slot:    string
  pickup_date:    string
  scheduled_at:   string
  total_cents:    number
  subtotal_cents: number
  tax_cents:      number
  customer_name:  string
  locations: { name: string; city: string | null; state: string | null } | null
  remote_order_items: {
    id:               string
    product_name:     string
    quantity:         number
    unit_price_cents: number
    modifiers:        { name: string; price_delta: number }[]
  }[]
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12  = h % 12 || 12
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, '0')}${ampm}`
}

function formatDate(d: string): string {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// Detect whether we're running inside the installed PWA (standalone) or in a regular browser.
// When Square redirects back after payment, the confirmation URL opens in Safari — not the PWA.
// We use this flag to render different CTAs for each context.
function getIsStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  )
}

export function OrderConfirmationPage() {
  const navigate          = useNavigate()
  const [params]          = useSearchParams()
  const orderId           = params.get('order_id')
  const isStandalone      = getIsStandalone()

  const [order,    setOrder]    = useState<OrderDetail | null>(null)
  const [loading,  setLoading]  = useState(true)
  // 'notfound' = genuinely missing, 'autherror' = session missing (expected in Safari context)
  const [errorKind, setErrorKind] = useState<'notfound' | 'autherror' | null>(null)

  useEffect(() => {
    if (!orderId) { setErrorKind('notfound'); setLoading(false); return }
    // When Square redirects back after payment, the page opens in Safari — not
    // the PWA. The Supabase session lives in the PWA's localStorage and is not
    // accessible there. RLS will silently return 0 rows (not an auth error code),
    // which would show "Order not found" to a customer who just successfully paid.
    // Skip the query entirely in non-standalone context and show the success
    // fallback directly — we know payment succeeded because Square sent this URL.
    if (!isStandalone) { setErrorKind('autherror'); setLoading(false); return }
    loadOrder()
  }, [orderId])

  async function loadOrder() {
    try {
      const { data, error } = await supabase
        .from('remote_orders')
        .select(`
          id, order_number, state, pickup_slot, pickup_date, scheduled_at,
          total_cents, subtotal_cents, tax_cents, customer_name,
          locations ( name, city, state ),
          remote_order_items ( id, product_name, quantity, unit_price_cents, modifiers )
        `)
        .eq('id', orderId)
        .single()

      if (error) {
        // Auth/JWT errors are expected when loaded in Safari — the PWA session
        // is not available there. Show a graceful fallback rather than "not found".
        const isAuthError =
          error.code === 'PGRST301' ||
          error.message?.toLowerCase().includes('jwt') ||
          error.message?.toLowerCase().includes('auth') ||
          error.message?.toLowerCase().includes('anon')
        setErrorKind(isAuthError ? 'autherror' : 'notfound')
        setLoading(false)
        return
      }

      if (!data) { setErrorKind('notfound'); setLoading(false); return }

      // Deduplicate items — remote_order_items may have one row per station per item
      const raw  = data as any
      const seen = new Set<string>()
      const dedupedItems = (raw.remote_order_items ?? []).filter((item: any) => {
        if (seen.has(item.product_name)) return false
        seen.add(item.product_name)
        return true
      })

      setOrder({ ...raw, remote_order_items: dedupedItems })
      setLoading(false)
    } catch (e) {
      setErrorKind('autherror')
      setLoading(false)
    }
  }

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--pd-off-white)' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--pd-green-light)', borderTopColor: 'var(--pd-green)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ─── Auth error fallback (loaded in Safari, no PWA session) ─────────────────
  // We know the order succeeded (Square confirmed it), we just can't query details.
  // Show a warm confirmation and tell the user to return to the app.

  if (errorKind === 'autherror') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--pd-off-white)', padding: 'var(--page-px)', textAlign: 'center', gap: 'var(--space-lg)' }}>

        {/* Success icon */}
        <div style={{ width: 80, height: 80, background: 'var(--pd-green-dark)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
          ✓
        </div>

        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', color: 'var(--pd-text)', lineHeight: 1.2 }}>
            Order Placed!
          </p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--pd-text-muted)', marginTop: 8 }}>
            Your payment was successful.
          </p>
          {orderId && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--pd-text-muted)', marginTop: 4, fontFamily: 'monospace' }}>
              Ref: {orderId.slice(0, 8).toUpperCase()}
            </p>
          )}
        </div>

        {/* Return-to-app banner */}
        <div style={{
          background: 'var(--pd-green-light)',
          border: '1px solid #86efac',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          width: '100%',
          maxWidth: 360,
        }}>
          <p style={{ fontSize: 28 }}>☝️</p>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--pd-green-dark)', lineHeight: 1.4 }}>
            Tap <strong>Done</strong> above to return to the Plusdine app,
            where you can view your full order details.
          </p>
        </div>

        {/* Attempt to close this browser window (works when opened via window.open) */}
        <button
          onClick={() => { try { window.close() } catch (_) {} }}
          style={{
            background: 'var(--pd-green-dark)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: '16px 40px',
            fontSize: 'var(--text-base)',
            fontWeight: 700,
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
            width: '100%',
            maxWidth: 360,
          }}
        >
          Done
        </button>
      </div>
    )
  }

  // ─── Genuinely not found ────────────────────────────────────────────────────

  if (errorKind === 'notfound' || !order) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--pd-off-white)', padding: 'var(--page-px)', textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 'var(--space-md)' }}>❓</div>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', marginBottom: 8 }}>Order not found</p>
        <button onClick={() => navigate('/home')} style={{ marginTop: 'var(--space-lg)', background: 'var(--pd-green-dark)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', padding: '14px 32px', fontSize: 'var(--text-base)', fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
          Go home
        </button>
      </div>
    )
  }

  // ─── Full receipt (loaded inside the PWA — standalone mode) ─────────────────

  const isPending   = order.state === 'pending'
  const isConfirmed = order.state === 'confirmed' || order.state === 'active'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--pd-off-white)', maxWidth: 480, margin: '0 auto' }}>

      {/* Success header */}
      <div style={{
        background: 'var(--pd-green-dark)',
        paddingTop: 'calc(var(--safe-top) + 32px)',
        paddingBottom: 32,
        paddingLeft: 'var(--page-px)',
        paddingRight: 'var(--page-px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 72, height: 72,
          background: 'var(--pd-yellow)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36,
        }}>
          ✓
        </div>
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', color: '#fff', lineHeight: 1.2 }}>
            Order Placed!
          </p>
          <p style={{ color: 'var(--pd-yellow)', fontSize: 'var(--text-base)', fontWeight: 700, marginTop: 4 }}>
            #{order.order_number}
          </p>
        </div>
        {order.locations && (
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 'var(--text-sm)' }}>
            {order.locations.name}
          </p>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 'var(--space-lg) var(--page-px)', paddingBottom: 'calc(var(--safe-bottom) + 100px)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

        {/* Pickup info */}
        <div style={{ background: 'var(--pd-white)', borderRadius: 'var(--radius-md)', border: '1px solid var(--pd-gray-light)', padding: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <div style={{ fontSize: 32, flexShrink: 0 }}>🕐</div>
            <div>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--pd-text-muted)', marginBottom: 2 }}>Pickup</p>
              <p style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--pd-text)' }}>
                {formatTime(order.pickup_slot)}
              </p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--pd-text-muted)' }}>
                {formatDate(order.pickup_date)}
              </p>
            </div>
          </div>
        </div>

        {/* Status */}
        <div style={{
          background: isPending ? '#fffbeb' : 'var(--pd-green-light)',
          border: `1px solid ${isPending ? '#fde68a' : '#86efac'}`,
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-md)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>{isPending ? '⏳' : '✅'}</span>
          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: isPending ? '#92400e' : 'var(--pd-green-dark)' }}>
            {isPending
              ? "Payment processing… we'll have your order shortly."
              : 'Payment confirmed — your order is on its way!'
            }
          </p>
        </div>

        {/* Items */}
        <div>
          <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--pd-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-md)' }}>
            Order Summary
          </p>
          <div style={{ background: 'var(--pd-white)', borderRadius: 'var(--radius-md)', border: '1px solid var(--pd-gray-light)', overflow: 'hidden' }}>
            {order.remote_order_items.map((item, idx) => (
              <div key={item.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                padding: 'var(--space-md) var(--space-lg)',
                borderTop: idx > 0 ? '1px solid var(--pd-gray-light)' : 'none',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    {item.quantity}× {item.product_name}
                  </p>
                  {item.modifiers?.length > 0 && (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--pd-text-muted)', marginTop: 2 }}>
                      {item.modifiers.map((m: any) => m.name).join(', ')}
                    </p>
                  )}
                </div>
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, flexShrink: 0, marginLeft: 12 }}>
                  {formatCents(item.unit_price_cents * item.quantity)}
                </p>
              </div>
            ))}

            {/* Totals */}
            <div style={{ borderTop: '1px solid var(--pd-gray-light)', padding: 'var(--space-md) var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--pd-text-muted)' }}>Subtotal</span>
                <span style={{ fontSize: 'var(--text-sm)' }}>{formatCents(order.subtotal_cents)}</span>
              </div>
              {order.tax_cents > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--pd-text-muted)' }}>Tax</span>
                  <span style={{ fontSize: 'var(--text-sm)' }}>{formatCents(order.tax_cents)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--pd-gray-light)' }}>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Total</span>
                <span style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>{formatCents(order.total_cents)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky bottom nav — PWA context only */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480,
        padding: `var(--space-md) var(--page-px) calc(var(--safe-bottom) + var(--space-md))`,
        background: 'linear-gradient(to top, var(--pd-off-white) 80%, transparent)',
        zIndex: 20,
        display: 'flex', gap: 'var(--space-sm)',
      }}>
        <button
          onClick={() => navigate('/home?tab=order')}
          style={{
            flex: 1,
            background: 'var(--pd-yellow)',
            color: 'var(--pd-green-dark)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: 16,
            fontSize: 'var(--text-base)',
            fontWeight: 700,
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
          }}
        >
          View Orders
        </button>
        <button
          onClick={() => navigate('/home')}
          style={{
            flex: 1,
            background: 'var(--pd-green-dark)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: 16,
            fontSize: 'var(--text-base)',
            fontWeight: 700,
            fontFamily: 'var(--font-body)',
            cursor: 'pointer',
          }}
        >
          Home
        </button>
      </div>
    </div>
  )
}

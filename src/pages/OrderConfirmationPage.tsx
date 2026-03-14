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

export function OrderConfirmationPage() {
  const navigate       = useNavigate()
  const [params]       = useSearchParams()
  const orderId        = params.get('order_id')

  const [order,   setOrder]   = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!orderId) { setNotFound(true); setLoading(false); return }
    loadOrder()
  }, [orderId])

  async function loadOrder() {
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

    if (error || !data) { setNotFound(true); setLoading(false); return }

    // Deduplicate items — remote_order_items has one row per station per item
    // Show each unique product_name once with its quantity
    const raw = data as any
    const seen = new Set<string>()
    const dedupedItems = (raw.remote_order_items ?? []).filter((item: any) => {
      if (seen.has(item.product_name)) return false
      seen.add(item.product_name)
      return true
    })

    setOrder({ ...raw, remote_order_items: dedupedItems })
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--pd-off-white)' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--pd-green-light)', borderTopColor: 'var(--pd-green)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (notFound || !order) {
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
      <div style={{ flex: 1, padding: 'var(--space-lg) var(--page-px)', paddingBottom: 'calc(var(--safe-bottom) + var(--space-2xl))', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>

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
              ? 'Payment processing… we\'ll have your order shortly.'
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

      {/* Sticky bottom nav */}
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

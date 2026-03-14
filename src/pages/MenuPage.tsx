import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCartStore } from '../stores/cartStore'
import { useAuthStore } from '../stores/authStore'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuSection {
  id:            string
  name:          string
  display_order: number
}

interface MenuItemRaw {
  id:                    string
  section_id:            string
  remote_order_allowed:  boolean
  remote_order_note:     string | null
  products: {
    id:          string
    name:        string
    description: string | null
    price:       number
    image_url:   string | null
  } | {
    id:          string
    name:        string
    description: string | null
    price:       number
    image_url:   string | null
  }[]
}

interface MenuItem {
  id:                    string
  section_id:            string
  remote_order_allowed:  boolean
  remote_order_note:     string | null
  products: {
    id:          string
    name:        string
    description: string | null
    price:       number
    image_url:   string | null
  }
}

interface OrderWindow {
  window_open:  string
  window_close: string
  is_active:    boolean
}

interface PickupWindow {
  pickup_start:  string
  pickup_end:    string
  is_active:     boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12  = h % 12 || 12
  return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, '0')}${ampm}`
}

function isCurrentlyOpen(open: string, close: string): boolean {
  const now   = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const [oh, om] = open.split(':').map(Number)
  const [ch, cm] = close.split(':').map(Number)
  return nowMins >= oh * 60 + om && nowMins < ch * 60 + cm
}

function getDayOfWeek(): number {
  return new Date().getDay()
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  inCart,
  onAdd,
}: {
  item:   MenuItem
  inCart: number
  onAdd:  (item: MenuItem) => void
}) {
  const product = item.products
  const priceCents = Math.round(product.price * 100)

  return (
    <div style={{
      background: 'var(--pd-white)',
      borderRadius: 'var(--radius-md)',
      border: `1.5px solid ${inCart > 0 ? 'var(--pd-green)' : 'var(--pd-gray-light)'}`,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      transition: 'border-color 0.15s ease',
    }}>
      {/* Item photo */}
      {product.image_url ? (
        <div style={{
          width: '100%', height: 140,
          background: 'var(--pd-gray-light)',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          <img
            src={product.image_url}
            alt={product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        </div>
      ) : (
        <div style={{
          width: '100%', height: 100,
          background: 'var(--pd-green-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '36px', flexShrink: 0,
        }}>
          🍽️
        </div>
      )}

      {/* Info */}
      <div style={{ padding: 'var(--space-md)', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--pd-text)', lineHeight: 1.3 }}>
          {product.name}
        </p>
        {product.description && (
          <p style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--pd-text-muted)',
            lineHeight: 1.5,
            flex: 1,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          } as React.CSSProperties}>
            {product.description}
          </p>
        )}
        {item.remote_order_note && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--pd-green)', fontStyle: 'italic' }}>
            {item.remote_order_note}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--pd-text)' }}>
            {formatCents(priceCents)}
          </span>
          <button
            onClick={() => onAdd(item)}
            style={{
              background: inCart > 0 ? 'var(--pd-green)' : 'var(--pd-green-dark)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 16px',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'background 0.15s ease',
            }}
          >
            {inCart > 0 ? (
              <><span style={{ background: 'var(--pd-yellow)', color: 'var(--pd-green-dark)', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800 }}>{inCart}</span> Add more</>
            ) : (
              <><span style={{ fontSize: '16px' }}>+</span> Add</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function MenuPage() {
  const { locationId } = useParams<{ locationId: string }>()
  const navigate       = useNavigate()
  const { savedLocations } = useAuthStore()
  const { addItem, items: cartItems, itemCount, subtotalCents, locationId: cartLocationId } = useCartStore()

  const [sections,      setSections]      = useState<MenuSection[]>([])
  const [menuItems,     setMenuItems]     = useState<MenuItem[]>([])
  const [menuId,        setMenuId]        = useState<string | null>(null)
  const [orderWindow,   setOrderWindow]   = useState<OrderWindow | null>(null)
  const [pickupWindow,  setPickupWindow]  = useState<PickupWindow | null>(null)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [orderingOpen,  setOrderingOpen]  = useState(false)

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const location = savedLocations.find(sl => sl.location_id === locationId)?.location

  useEffect(() => {
    if (!locationId) return
    loadMenu()
  }, [locationId])

  async function loadMenu() {
    setLoading(true)
    const dow = getDayOfWeek()

    // Load ordering + pickup windows
    const [owRes, pwRes] = await Promise.all([
      supabase
        .from('order_window_configs')
        .select('window_open, window_close, is_active')
        .eq('location_id', locationId)
        .eq('day_of_week', dow)
        .maybeSingle(),
      supabase
        .from('pickup_slot_configs')
        .select('pickup_start, pickup_end, is_active')
        .eq('location_id', locationId)
        .eq('day_of_week', dow)
        .maybeSingle(),
    ])

    const ow = owRes.data as OrderWindow | null
    const pw = pwRes.data as PickupWindow | null
    setOrderWindow(ow)
    setPickupWindow(pw)
    setOrderingOpen(!!(ow?.is_active && isCurrentlyOpen(ow.window_open, ow.window_close)))

    // Find the active café menu for this location
    const today = new Date().toISOString().split('T')[0]
    const { data: schedule } = await supabase
      .from('menu_schedules')
      .select('menu_id')
      .eq('location_id', locationId)
      .lte('start_date', today)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Fallback: just get the first active menu for this location
    let resolvedMenuId = schedule?.menu_id ?? null
    if (!resolvedMenuId) {
      const { data: fallbackMenu } = await supabase
        .from('menus')
        .select('id')
        .eq('location_id', locationId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      resolvedMenuId = fallbackMenu?.id ?? null
    }

    if (!resolvedMenuId) { setLoading(false); return }
    setMenuId(resolvedMenuId)

    // Load sections + items
    const { data: sectionsData } = await supabase
      .from('menu_sections')
      .select('id, name, display_order')
      .eq('menu_id', resolvedMenuId)
      .order('display_order')

    const { data: itemsData } = await supabase
      .from('menu_items')
      .select(`
        id, section_id, remote_order_allowed, remote_order_note,
        products ( id, name, description, price, image_url )
      `)
      .eq('menu_id', resolvedMenuId)
      .eq('remote_order_allowed', true)
      .order('display_order')

    setSections((sectionsData ?? []) as MenuSection[])
    // Supabase may return products as array or object depending on relation type
    const normalized: MenuItem[] = (itemsData ?? []).map((item: any) => ({
      ...item,
      products: Array.isArray(item.products) ? item.products[0] : item.products,
    })).filter((item: any) => item.products)
    setMenuItems(normalized)
    if (sectionsData?.length) setActiveSection(sectionsData[0].id)

    setLoading(false)
  }

  const handleAdd = (item: MenuItem) => {
    if (!menuId || !locationId) return
    addItem({
      menu_item_id:  item.id,
      product_name:  item.products.name,
      unit_price:    Math.round(item.products.price * 100),
      modifiers:     [],
      image_url:     item.products.image_url,
    }, locationId, menuId)
  }

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId)
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const cartCount    = itemCount()
  const cartSubtotal = subtotalCents()

  // Group items by section
  const itemsBySection = sections.reduce<Record<string, MenuItem[]>>((acc, sec) => {
    acc[sec.id] = menuItems.filter(i => i.section_id === sec.id)
    return acc
  }, {})

  const hasCartFromHere = cartLocationId === locationId

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
        paddingBottom: 14,
        paddingLeft: 'var(--page-px)',
        paddingRight: 'var(--page-px)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}>
        <button
          onClick={() => navigate('/home')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#fff', fontSize: 22, padding: '4px 0', lineHeight: 1,
            flexShrink: 0,
          }}
          aria-label="Back"
        >
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 'var(--text-base)', lineHeight: 1.2, truncate: true } as React.CSSProperties}>
            {location?.name ?? 'Menu'}
          </p>
          {location && (
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'var(--text-xs)', lineHeight: 1 }}>
              {[location.city, location.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      </header>

      {/* Ordering window info banner */}
      <div style={{
        background: orderingOpen ? 'var(--pd-green-mid)' : 'var(--pd-green-dark)',
        padding: '10px var(--page-px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        {/* Ordering window */}
        {orderWindow?.is_active ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: orderingOpen ? 'var(--pd-yellow)' : 'rgba(255,255,255,0.3)',
            }} />
            <p style={{ fontSize: 'var(--text-xs)', color: orderingOpen ? 'var(--pd-yellow)' : 'rgba(255,255,255,0.6)' }}>
              {orderingOpen
                ? `Ordering open · closes ${formatTime(orderWindow.window_close)}`
                : `Ordering closed · opens ${formatTime(orderWindow.window_open)}`
              }
            </p>
          </div>
        ) : (
          <p style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.45)' }}>
            Online ordering not available today
          </p>
        )}

        {/* Pickup window */}
        {pickupWindow?.is_active && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.55)' }}>
            🕐 Pickup {formatTime(pickupWindow.pickup_start)}–{formatTime(pickupWindow.pickup_end)}
          </p>
        )}
      </div>

      {/* Section nav — sticky below header */}
      {sections.length > 1 && (
        <div style={{
          background: 'var(--pd-white)',
          borderBottom: '1px solid var(--pd-gray-light)',
          overflowX: 'auto',
          display: 'flex',
          gap: 4,
          padding: '0 var(--page-px)',
          position: 'sticky',
          top: 'calc(var(--safe-top) + 58px)',
          zIndex: 10,
          scrollbarWidth: 'none',
        } as React.CSSProperties}>
          {sections.map(sec => (
            <button
              key={sec.id}
              onClick={() => scrollToSection(sec.id)}
              style={{
                flexShrink: 0,
                background: 'none',
                border: 'none',
                borderBottom: activeSection === sec.id
                  ? '2.5px solid var(--pd-green)'
                  : '2.5px solid transparent',
                padding: '12px 12px',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-body)',
                fontWeight: activeSection === sec.id ? 600 : 400,
                color: activeSection === sec.id ? 'var(--pd-green)' : 'var(--pd-text-muted)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {sec.name}
            </button>
          ))}
        </div>
      )}

      {/* Menu content */}
      <div style={{
        flex: 1,
        padding: 'var(--space-md) var(--page-px)',
        paddingBottom: cartCount > 0 ? 100 : 'calc(var(--safe-bottom) + var(--space-lg))',
      }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <div style={{
              width: 32, height: 32,
              border: '3px solid var(--pd-green-light)',
              borderTopColor: 'var(--pd-green)',
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }} />
          </div>
        ) : menuItems.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 44, marginBottom: 'var(--space-md)' }}>🍽️</div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', marginBottom: 8 }}>
              No items available
            </p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--pd-text-muted)' }}>
              Check back during ordering hours.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
            {sections.map(sec => {
              const secItems = itemsBySection[sec.id] ?? []
              if (secItems.length === 0) return null
              return (
                <div
                  key={sec.id}
                  ref={el => { sectionRefs.current[sec.id] = el }}
                >
                  <p style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: 'var(--pd-text-muted)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    marginBottom: 'var(--space-md)',
                  }}>
                    {sec.name}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    {secItems.map(item => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        inCart={cartItems.find(c => c.menu_item_id === item.id)?.quantity ?? 0}
                        onAdd={handleAdd}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Floating cart button */}
      {hasCartFromHere && cartCount > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(var(--safe-bottom) + 20px)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 30,
          width: 'calc(100% - 40px)',
          maxWidth: 440,
        }}>
          <button
            onClick={() => navigate('/cart')}
            style={{
              width: '100%',
              background: 'var(--pd-yellow)',
              color: 'var(--pd-green-dark)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              fontSize: 'var(--text-base)',
              fontWeight: 700,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <span style={{
              background: 'var(--pd-green-dark)',
              color: 'var(--pd-yellow)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 10px',
              fontSize: 'var(--text-sm)',
              fontWeight: 800,
            }}>
              {cartCount}
            </span>
            <span>View Cart</span>
            <span>{formatCents(cartSubtotal)}</span>
          </button>
        </div>
      )}
    </div>
  )
}

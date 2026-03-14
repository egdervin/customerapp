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

interface MenuItem {
  id:                    string
  section_id:            string
  price:                 number | null   // menu-item price override; null = use products.base_price
  remote_order_allowed:  boolean
  remote_order_note:     string | null
  products: {
    id:          string
    name:        string
    description: string | null
    base_price:  number
    image_url:   string | null
  }
  modifiers: ModifierGroup[]
}

// ─── Modifier types ───────────────────────────────────────────────────────────

interface ModifierOption {
  id:          string
  name:        string
  price_delta: number
}

interface ModifierGroup {
  mim_id:         string
  group_id:       string
  name:           string
  selection_type: 'pick_one' | 'pick_multiple' | 'pick_up_to_max' | 'pick_up_to_max_free'
  is_required:    boolean
  min_selections: number
  max_selections: number
  max_free:       number | null
  extra_price:    number | null
  options:        ModifierOption[]
}

type ModifierSelections = Record<string, string[]>

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
  if (!t) return ''
  let h: number, m: number
  if (t.includes(':')) {
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

function isCurrentlyOpen(open: string, close: string): boolean {
  const now     = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const [oh, om] = open.split(':').map(Number)
  const [ch, cm] = close.split(':').map(Number)
  return nowMins >= oh * 60 + om && nowMins < ch * 60 + cm
}

function getDayOfWeek(): number { return new Date().getDay() }

function formatCents(cents: number): string { return `$${(cents / 100).toFixed(2)}` }

function effectivePrice(item: MenuItem): number {
  return (item.price !== null && item.price !== undefined) ? item.price : item.products.base_price
}

// ─── Modifier Modal ───────────────────────────────────────────────────────────

function ModifierModal({ item, onConfirm, onCancel }: {
  item:      MenuItem
  onConfirm: (selections: ModifierSelections) => void
  onCancel:  () => void
}) {
  const [selections, setSelections] = useState<ModifierSelections>({})

  const toggleOption = (group: ModifierGroup, optionId: string) => {
    setSelections(prev => {
      const current = prev[group.group_id] ?? []
      if (group.selection_type === 'pick_one') {
        // Radio — always replace
        return { ...prev, [group.group_id]: [optionId] }
      }
      // For pick_multiple: unlimited. For pick_up_to_max / pick_up_to_max_free: honor max_selections.
      const maxSel = (group.selection_type === 'pick_multiple')
        ? Infinity
        : group.max_selections > 0 ? group.max_selections : Infinity
      if (current.includes(optionId)) {
        return { ...prev, [group.group_id]: current.filter(id => id !== optionId) }
      }
      if (current.length >= maxSel) return prev
      return { ...prev, [group.group_id]: [...current, optionId] }
    })
  }

  const extraCents = item.modifiers.reduce((total, group) => {
    const chosen = selections[group.group_id] ?? []
    return total + chosen.reduce((sum, optId) => {
      const opt = group.options.find(o => o.id === optId)
      if (!opt) return sum
      if (group.selection_type === 'pick_up_to_max_free' && group.max_free !== null) {
        const idx = chosen.indexOf(optId)
        return sum + (idx >= group.max_free ? Math.round((group.extra_price ?? opt.price_delta) * 100) : 0)
      }
      return sum + Math.round(opt.price_delta * 100)
    }, 0)
  }, 0)

  const isValid = item.modifiers.every(group => {
    if (!group.is_required) return true
    return (selections[group.group_id] ?? []).length >= group.min_selections
  })

  const basePrice  = Math.round(effectivePrice(item) * 100)
  const totalPrice = basePrice + extraCents

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'relative', zIndex: 1, background: 'var(--pd-white)',
        borderRadius: '20px 20px 0 0', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        maxWidth: 480, margin: '0 auto', width: '100%',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--pd-gray-mid)' }} />
        </div>
        <div style={{ padding: '8px var(--page-px) 16px' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 700 }}>
            {item.products.name}
          </p>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--pd-text-muted)', marginTop: 2 }}>
            {formatCents(basePrice)}
          </p>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '0 var(--page-px)' }}>
          {item.modifiers.map(group => {
            const chosen   = selections[group.group_id] ?? []
            const maxLabel = group.selection_type === 'pick_one'    ? 'Choose 1'
              : group.selection_type === 'pick_multiple'             ? 'Choose any'
              : group.max_selections > 0 ? `Choose up to ${group.max_selections}` : 'Choose any'
            return (
              <div key={group.group_id} style={{ marginBottom: 'var(--space-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                  <p style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--pd-text)' }}>
                    {group.name}
                    {group.is_required && (
                      <span style={{ marginLeft: 6, fontSize: 'var(--text-xs)', color: '#e53e3e', fontWeight: 500 }}>Required</span>
                    )}
                  </p>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--pd-text-muted)' }}>{maxLabel}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {group.options.map(opt => {
                    const isSelected = chosen.includes(opt.id)
                    const isRadio    = group.selection_type === 'pick_one'
                    return (
                      <button key={opt.id} onClick={() => toggleOption(group, opt.id)} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px',
                        background: isSelected ? 'var(--pd-green-light)' : 'var(--pd-off-white)',
                        border: `1.5px solid ${isSelected ? 'var(--pd-green)' : 'var(--pd-gray-light)'}`,
                        borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                        fontFamily: 'var(--font-body)', textAlign: 'left',
                        transition: 'all 0.1s ease', width: '100%',
                      }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: isRadio ? '50%' : 4,
                          border: `2px solid ${isSelected ? 'var(--pd-green)' : 'var(--pd-gray-mid)'}`,
                          background: isSelected ? 'var(--pd-green)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, transition: 'all 0.1s ease',
                        }}>
                          {isSelected && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              {isRadio
                                ? <circle cx="5" cy="5" r="3" fill="white"/>
                                : <path d="M2 5l2.5 2.5L8 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                              }
                            </svg>
                          )}
                        </div>
                        <span style={{ flex: 1, fontSize: 'var(--text-sm)', color: 'var(--pd-text)', fontWeight: isSelected ? 600 : 400 }}>
                          {opt.name}
                        </span>
                        {opt.price_delta > 0 && (
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--pd-text-muted)', flexShrink: 0 }}>
                            +{formatCents(Math.round(opt.price_delta * 100))}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
          <div style={{ height: 8 }} />
        </div>

        <div style={{ padding: `var(--space-md) var(--page-px) calc(var(--safe-bottom) + var(--space-md))`, borderTop: '1px solid var(--pd-gray-light)' }}>
          <button onClick={() => isValid && onConfirm(selections)} disabled={!isValid} style={{
            width: '100%',
            background: isValid ? 'var(--pd-yellow)' : 'var(--pd-gray-mid)',
            color: isValid ? 'var(--pd-green-dark)' : 'var(--pd-gray)',
            border: 'none', borderRadius: 'var(--radius-md)', padding: '16px 20px',
            fontSize: 'var(--text-base)', fontWeight: 700, fontFamily: 'var(--font-body)',
            cursor: isValid ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>Add to Cart</span>
            <span>{formatCents(totalPrice)}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({ item, inCart, onAdd }: { item: MenuItem; inCart: number; onAdd: (item: MenuItem) => void }) {
  const product    = item.products
  const priceCents = Math.round(effectivePrice(item) * 100)

  return (
    <div style={{
      background: 'var(--pd-white)', borderRadius: 'var(--radius-md)',
      border: `1.5px solid ${inCart > 0 ? 'var(--pd-green)' : 'var(--pd-gray-light)'}`,
      overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'border-color 0.15s ease',
    }}>
      {product.image_url ? (
        <div style={{ width: '100%', height: 140, background: 'var(--pd-gray-light)', overflow: 'hidden', flexShrink: 0 }}>
          <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
        </div>
      ) : (
        <div style={{ width: '100%', height: 100, background: 'var(--pd-green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', flexShrink: 0 }}>
          🍽️
        </div>
      )}
      <div style={{ padding: 'var(--space-md)', flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--pd-text)', lineHeight: 1.3 }}>{product.name}</p>
        {product.description && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--pd-text-muted)', lineHeight: 1.5, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
            {product.description}
          </p>
        )}
        {item.remote_order_note && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--pd-green)', fontStyle: 'italic' }}>{item.remote_order_note}</p>
        )}
        {item.modifiers.length > 0 && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--pd-text-muted)' }}>
            {item.modifiers.map(g => g.name).join(' · ')}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--pd-text)' }}>{formatCents(priceCents)}</span>
          <button onClick={() => onAdd(item)} style={{
            background: inCart > 0 ? 'var(--pd-green)' : 'var(--pd-green-dark)',
            color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)',
            padding: '8px 16px', fontSize: 'var(--text-sm)', fontWeight: 600,
            fontFamily: 'var(--font-body)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.15s ease',
          }}>
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
  const [modalItem,     setModalItem]     = useState<MenuItem | null>(null)

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const location    = savedLocations.find(sl => sl.location_id === locationId)?.location

  useEffect(() => { if (locationId) loadMenu() }, [locationId])

  async function loadMenu() {
    setLoading(true)
    const dow = getDayOfWeek()

    const [owRes, pwRes] = await Promise.all([
      supabase.from('order_window_configs').select('window_open, window_close, is_active').eq('location_id', locationId).eq('day_of_week', dow).maybeSingle(),
      supabase.from('pickup_slot_configs').select('pickup_start, pickup_end, is_active').eq('location_id', locationId).eq('day_of_week', dow).maybeSingle(),
    ])
    const ow = owRes.data as OrderWindow | null
    const pw = pwRes.data as PickupWindow | null
    setOrderWindow(ow)
    setPickupWindow(pw)
    setOrderingOpen(!!(ow?.is_active && isCurrentlyOpen(ow.window_open, ow.window_close)))

    // Resolve menu: prefer default static → any static → default rotational → any rotational
    let resolvedMenuId: string | null = null
    {
      const { data: allActive } = await supabase
        .from('menus').select('id, menu_type, is_default')
        .eq('location_id', locationId).eq('status', 'active')
        .in('menu_type', ['static', 'rotational']).order('created_at', { ascending: true })
      const c = allActive ?? []
      const pick =
        c.find(m => m.menu_type === 'static'     && m.is_default) ??
        c.find(m => m.menu_type === 'static') ??
        c.find(m => m.menu_type === 'rotational' && m.is_default) ??
        c.find(m => m.menu_type === 'rotational') ?? null
      resolvedMenuId = pick?.id ?? null
    }

    if (!resolvedMenuId) { setLoading(false); return }
    setMenuId(resolvedMenuId)

    const [sectionsRes, itemsRes] = await Promise.all([
      supabase.from('menu_sections').select('id, name, display_order').eq('menu_id', resolvedMenuId).order('display_order'),
      supabase.from('menu_items').select(`
        id, section_id, price, remote_order_allowed, remote_order_note,
        products ( id, name, description, base_price, image_url )
      `).eq('menu_id', resolvedMenuId).eq('remote_order_allowed', true).order('display_order'),
    ])

    const sectionsData = sectionsRes.data ?? []
    setSections(sectionsData as MenuSection[])

    const normalizedBase = (itemsRes.data ?? []).map((item: any) => ({
      ...item,
      products: Array.isArray(item.products) ? item.products[0] : item.products,
    })).filter((item: any) => item.products)

    // Load modifiers
    const menuItemIds = normalizedBase.map((i: any) => i.id)
    let modifiersByItem: Record<string, ModifierGroup[]> = {}

    if (menuItemIds.length > 0) {
      const { data: mims } = await supabase
        .from('menu_item_modifiers')
        .select('id, menu_item_id, modifier_group_id, is_required, min_selections, max_selections, max_free, display_order')
        .in('menu_item_id', menuItemIds).order('display_order')

      if (mims && mims.length > 0) {
        const groupIds = [...new Set((mims as any[]).map(m => m.modifier_group_id))]
        const [groupsRes, optionsRes] = await Promise.all([
          supabase.from('modifier_groups').select('id, name, selection_type, extra_price').in('id', groupIds),
          supabase.from('modifier_options').select('id, modifier_group_id, name, price_delta, display_order, is_active')
            .in('modifier_group_id', groupIds).eq('is_active', true).order('display_order'),
        ])
        const groupMap = Object.fromEntries((groupsRes.data ?? []).map((g: any) => [g.id, g]))
        const optsByGroup: Record<string, ModifierOption[]> = {}
        for (const o of (optionsRes.data ?? []) as any[]) {
          if (!optsByGroup[o.modifier_group_id]) optsByGroup[o.modifier_group_id] = []
          optsByGroup[o.modifier_group_id].push({ id: o.id, name: o.name, price_delta: o.price_delta })
        }
        for (const mim of mims as any[]) {
          const g = groupMap[mim.modifier_group_id]
          if (!g) continue
          if (!modifiersByItem[mim.menu_item_id]) modifiersByItem[mim.menu_item_id] = []
          modifiersByItem[mim.menu_item_id].push({
            mim_id: mim.id, group_id: g.id, name: g.name,
            selection_type: g.selection_type, is_required: mim.is_required,
            min_selections: mim.min_selections, max_selections: mim.max_selections,
            max_free: mim.max_free, extra_price: g.extra_price,
            options: optsByGroup[g.id] ?? [],
          })
        }
      }
    }

    const normalized: MenuItem[] = normalizedBase.map((item: any) => ({
      ...item, modifiers: modifiersByItem[item.id] ?? [],
    }))
    setMenuItems(normalized)
    if (sectionsData.length) setActiveSection(sectionsData[0].id)
    setLoading(false)
  }

  const handleAdd = (item: MenuItem) => {
    if (item.modifiers.length > 0) { setModalItem(item) } else { commitAdd(item, {}) }
  }

  const commitAdd = (item: MenuItem, selections: ModifierSelections) => {
    if (!menuId || !locationId) return
    const modifiers = item.modifiers.flatMap(group => {
      const chosen = selections[group.group_id] ?? []
      return chosen.map(optId => {
        const opt = group.options.find(o => o.id === optId)!
        let priceDelta = Math.round(opt.price_delta * 100)
        if (group.selection_type === 'pick_up_to_max_free' && group.max_free !== null) {
          const idx = chosen.indexOf(optId)
          priceDelta = idx >= group.max_free ? Math.round((group.extra_price ?? opt.price_delta) * 100) : 0
        }
        return { modifier_option_id: opt.id, name: opt.name, price_delta: priceDelta }
      })
    })
    addItem({
      menu_item_id: item.id, product_name: item.products.name,
      unit_price: Math.round(effectivePrice(item) * 100),
      modifiers, image_url: item.products.image_url,
    }, locationId, menuId)
    setModalItem(null)
  }

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId)
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const cartCount       = itemCount()
  const cartSubtotal    = subtotalCents()
  const hasCartFromHere = cartLocationId === locationId
  const itemsBySection  = sections.reduce<Record<string, MenuItem[]>>((acc, sec) => {
    acc[sec.id] = menuItems.filter(i => i.section_id === sec.id)
    return acc
  }, {})

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--pd-off-white)', maxWidth: 480, margin: '0 auto' }}>

      <header style={{
        background: 'var(--pd-green-dark)',
        paddingTop: 'calc(var(--safe-top) + 14px)', paddingBottom: 14,
        paddingLeft: 'var(--page-px)', paddingRight: 'var(--page-px)',
        display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 20,
      }}>
        <button onClick={() => navigate('/home')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 22, padding: '4px 0', lineHeight: 1, flexShrink: 0 }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: '#fff', fontWeight: 700, fontSize: 'var(--text-base)', lineHeight: 1.2 }}>{location?.name ?? 'Menu'}</p>
          {location && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 'var(--text-xs)', lineHeight: 1 }}>{[location.city, location.state].filter(Boolean).join(', ')}</p>}
        </div>
      </header>

      <div style={{ background: orderingOpen ? 'var(--pd-green-mid)' : 'var(--pd-green-dark)', padding: '10px var(--page-px)', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {orderWindow?.is_active ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-flex', width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: orderingOpen ? 'var(--pd-yellow)' : 'rgba(255,255,255,0.3)' }} />
            <p style={{ fontSize: 'var(--text-xs)', color: orderingOpen ? 'var(--pd-yellow)' : 'rgba(255,255,255,0.6)' }}>
              {orderingOpen ? `Ordering open · closes ${formatTime(orderWindow.window_close)}` : `Ordering closed · opens ${formatTime(orderWindow.window_open)}`}
            </p>
          </div>
        ) : (
          <p style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.45)' }}>Online ordering not available today</p>
        )}
        {pickupWindow?.is_active && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.55)' }}>🕐 Pickup {formatTime(pickupWindow.pickup_start)}–{formatTime(pickupWindow.pickup_end)}</p>
        )}
      </div>

      {sections.length > 1 && (
        <div style={{ background: 'var(--pd-white)', borderBottom: '1px solid var(--pd-gray-light)', overflowX: 'auto', display: 'flex', gap: 4, padding: '0 var(--page-px)', position: 'sticky', top: 'calc(var(--safe-top) + 58px)', zIndex: 10, scrollbarWidth: 'none' } as React.CSSProperties}>
          {sections.map(sec => (
            <button key={sec.id} onClick={() => scrollToSection(sec.id)} style={{
              flexShrink: 0, background: 'none', border: 'none',
              borderBottom: activeSection === sec.id ? '2.5px solid var(--pd-green)' : '2.5px solid transparent',
              padding: '12px 12px', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-body)',
              fontWeight: activeSection === sec.id ? 600 : 400,
              color: activeSection === sec.id ? 'var(--pd-green)' : 'var(--pd-text-muted)',
              cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s ease',
            }}>{sec.name}</button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, padding: 'var(--space-md) var(--page-px)', paddingBottom: cartCount > 0 ? 100 : 'calc(var(--safe-bottom) + var(--space-lg))' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--pd-green-light)', borderTopColor: 'var(--pd-green)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          </div>
        ) : menuItems.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 44, marginBottom: 'var(--space-md)' }}>🍽️</div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', marginBottom: 8 }}>No items available</p>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--pd-text-muted)' }}>Check back during ordering hours.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
            {sections.map(sec => {
              const secItems = itemsBySection[sec.id] ?? []
              if (secItems.length === 0) return null
              return (
                <div key={sec.id} ref={el => { sectionRefs.current[sec.id] = el }}>
                  <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--pd-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-md)' }}>{sec.name}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    {secItems.map(item => (
                      <ItemCard key={item.id} item={item} inCart={cartItems.find(c => c.menu_item_id === item.id)?.quantity ?? 0} onAdd={handleAdd} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {hasCartFromHere && cartCount > 0 && (
        <div style={{ position: 'fixed', bottom: 'calc(var(--safe-bottom) + 20px)', left: '50%', transform: 'translateX(-50%)', zIndex: 30, width: 'calc(100% - 40px)', maxWidth: 440 }}>
          <button onClick={() => navigate('/cart')} style={{
            width: '100%', background: 'var(--pd-yellow)', color: 'var(--pd-green-dark)',
            border: 'none', borderRadius: 'var(--radius-md)', padding: '16px 20px',
            fontSize: 'var(--text-base)', fontWeight: 700, fontFamily: 'var(--font-body)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: 'var(--shadow-lg)',
          }}>
            <span style={{ background: 'var(--pd-green-dark)', color: 'var(--pd-yellow)', borderRadius: 'var(--radius-sm)', padding: '2px 10px', fontSize: 'var(--text-sm)', fontWeight: 800 }}>{cartCount}</span>
            <span>View Cart</span>
            <span>{formatCents(cartSubtotal)}</span>
          </button>
        </div>
      )}

      {modalItem && (
        <ModifierModal item={modalItem} onConfirm={sel => commitAdd(modalItem, sel)} onCancel={() => setModalItem(null)} />
      )}
    </div>
  )
}

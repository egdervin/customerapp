import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartModifier {
  modifier_option_id: string
  name:               string
  price_delta:        number   // cents
}

export interface CartItem {
  menu_item_id:   string
  product_name:   string
  quantity:       number
  unit_price:     number       // cents
  modifiers:      CartModifier[]
  image_url?:     string | null
}

interface CartState {
  locationId:    string | null
  menuId:        string | null
  items:         CartItem[]
  addItem:       (item: Omit<CartItem, 'quantity'>, locationId: string, menuId: string) => void
  removeItem:    (menuItemId: string) => void
  updateQty:     (menuItemId: string, quantity: number) => void
  clearCart:     () => void
  itemCount:     () => number
  subtotalCents: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      locationId: null,
      menuId:     null,
      items:      [],

      addItem: (item, locationId, menuId) => {
        const state = get()
        // If adding from a different location, clear cart first
        if (state.locationId && state.locationId !== locationId) {
          set({ items: [], locationId, menuId })
        }
        set((s) => {
          const existing = s.items.find((i) => i.menu_item_id === item.menu_item_id)
          if (existing) {
            return {
              items: s.items.map((i) =>
                i.menu_item_id === item.menu_item_id
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              ),
            }
          }
          return {
            locationId,
            menuId,
            items: [...s.items, { ...item, quantity: 1 }],
          }
        })
      },

      removeItem: (menuItemId) =>
        set((s) => ({ items: s.items.filter((i) => i.menu_item_id !== menuItemId) })),

      updateQty: (menuItemId, quantity) =>
        set((s) => ({
          items: quantity <= 0
            ? s.items.filter((i) => i.menu_item_id !== menuItemId)
            : s.items.map((i) => i.menu_item_id === menuItemId ? { ...i, quantity } : i),
        })),

      clearCart: () => set({ items: [], locationId: null, menuId: null }),

      itemCount:     () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      subtotalCents: () => get().items.reduce((sum, i) => {
        const modSum = i.modifiers.reduce((ms, m) => ms + m.price_delta, 0)
        return sum + (i.unit_price + modSum) * i.quantity
      }, 0),
    }),
    { name: 'plusdine-cart' }
  )
)

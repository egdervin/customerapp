import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

export interface CustomerProfile {
  id: string
  auth_user_id: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  qr_token: string | null
  balance: number
  location_id: string | null
  org_id: string | null
  is_active: boolean
  created_at: string
}

export interface CustomerLocation {
  id: string
  customer_id: string
  location_id: string
  org_id: string
  is_home: boolean
  first_visited_at: string
  last_visited_at: string
  location: {
    id: string
    name: string
    code: string | null
    signup_token: string | null
    city: string | null
    state: string | null
  }
}

interface AuthState {
  user: User | null
  session: Session | null
  customerProfile: CustomerProfile | null
  savedLocations: CustomerLocation[]
  loading: boolean
  needsProfileSetup: boolean

  initialize: () => Promise<void>
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  completeProfileSetup: (firstName: string, lastName: string) => Promise<{ error: string | null }>
  fetchCustomerProfile: (userId: string) => Promise<CustomerProfile | null>
  fetchSavedLocations: (customerId: string) => Promise<void>
  connectLocation: (token: string) => Promise<{ error: string | null; locationName?: string }>
  setHomeLocation: (customerLocationId: string) => Promise<{ error: string | null }>
}

const generateQrToken = () =>
  Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString()

async function createCustomerRecord(params: {
  authUserId: string
  firstName: string
  lastName: string
  email: string
}): Promise<{ data: CustomerProfile | null; error: string | null }> {
  const qr_token = generateQrToken()

  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      auth_user_id: params.authUserId,
      first_name: params.firstName,
      last_name: params.lastName,
      email: params.email,
      qr_token,
      is_active: true,
      // org_id intentionally omitted — assigned when customer connects to a location
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: customer as CustomerProfile, error: null }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  customerProfile: null,
  savedLocations: [],
  loading: true,
  needsProfileSetup: false,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      const profile = await get().fetchCustomerProfile(session.user.id)
      set({
        user: session.user,
        session,
        customerProfile: profile,
        needsProfileSetup: !profile,
        loading: false,
      })
      if (profile) {
        get().fetchSavedLocations(profile.id)
      }
    } else {
      set({ loading: false })
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await get().fetchCustomerProfile(session.user.id)
        set({
          user: session.user,
          session,
          customerProfile: profile,
          needsProfileSetup: !profile,
        })
        if (profile) {
          get().fetchSavedLocations(profile.id)
        }
      } else {
        set({ user: null, session: null, customerProfile: null, savedLocations: [], needsProfileSetup: false })
      }
    })
  },

  fetchCustomerProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('auth_user_id', userId)
      .single()

    if (error || !data) return null
    return data as CustomerProfile
  },

  fetchSavedLocations: async (customerId: string) => {
    const { data, error } = await supabase
      .from('customer_locations')
      .select(`
        *,
        location:locations(id, name, code, signup_token, city, state)
      `)
      .eq('customer_id', customerId)
      .order('is_home', { ascending: false })
      .order('last_visited_at', { ascending: false })

    if (!error && data) {
      set({ savedLocations: data as CustomerLocation[] })
    }
  },

  signUp: async (email, password, firstName, lastName) => {
    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      if (
        error.message.toLowerCase().includes('already registered') ||
        error.message.toLowerCase().includes('user already exists')
      ) {
        return get().signIn(email, password)
      }
      return { error: error.message }
    }

    if (!data.user) return { error: 'Signup failed. Please try again.' }

    const { error: createError } = await createCustomerRecord({
      authUserId: data.user.id,
      firstName,
      lastName,
      email,
    })

    if (createError) return { error: createError }
    return { error: null }
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }

    if (data.user) {
      const profile = await get().fetchCustomerProfile(data.user.id)
      set({
        user: data.user,
        session: data.session,
        customerProfile: profile,
        needsProfileSetup: !profile,
      })
      if (profile) {
        get().fetchSavedLocations(profile.id)
      }
    }
    return { error: null }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, customerProfile: null, savedLocations: [], needsProfileSetup: false })
  },

  completeProfileSetup: async (firstName, lastName) => {
    const { user } = get()
    if (!user) return { error: 'Not authenticated' }

    const { data, error } = await createCustomerRecord({
      authUserId: user.id,
      firstName,
      lastName,
      email: user.email ?? '',
    })

    if (error) return { error }
    set({ customerProfile: data, needsProfileSetup: false })
    return { error: null }
  },

  connectLocation: async (token: string) => {
    const { customerProfile } = get()
    if (!customerProfile) return { error: 'Not signed in' }

    // Look up the location by signup_token
    const { data: location, error: locationError } = await supabase
      .from('locations')
      .select('id, name, org_id, city, state')
      .ilike('signup_token', token.trim())
      .eq('is_active', true)
      .single()

    if (locationError || !location) {
      return { error: 'Location code not found. Please check and try again.' }
    }

    // Check if already saved
    const already = get().savedLocations.find(sl => sl.location_id === location.id)
    if (already) {
      return { error: null, locationName: location.name }
    }

    const isFirst = get().savedLocations.length === 0

    // Create customer_locations row
    const { error: linkError } = await supabase
      .from('customer_locations')
      .insert({
        customer_id: customerProfile.id,
        location_id: location.id,
        org_id: location.org_id,
        is_home: isFirst, // first location auto-becomes home
      })

    if (linkError) return { error: linkError.message }

    // If this is the first location, also set org_id on the customer row
    if (isFirst) {
      await supabase
        .from('customers')
        .update({ org_id: location.org_id, location_id: location.id })
        .eq('id', customerProfile.id)

      set(state => ({
        customerProfile: state.customerProfile
          ? { ...state.customerProfile, org_id: location.org_id, location_id: location.id }
          : null
      }))
    }

    // Refresh saved locations
    await get().fetchSavedLocations(customerProfile.id)

    return { error: null, locationName: location.name }
  },

  setHomeLocation: async (customerLocationId: string) => {
    const { customerProfile, savedLocations } = get()
    if (!customerProfile) return { error: 'Not signed in' }

    // Remove home from current home
    const currentHome = savedLocations.find(sl => sl.is_home)
    if (currentHome) {
      await supabase
        .from('customer_locations')
        .update({ is_home: false })
        .eq('id', currentHome.id)
    }

    // Set new home
    const { error } = await supabase
      .from('customer_locations')
      .update({ is_home: true })
      .eq('id', customerLocationId)

    if (error) return { error: error.message }

    await get().fetchSavedLocations(customerProfile.id)
    return { error: null }
  },
}))

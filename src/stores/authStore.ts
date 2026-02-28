import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

export interface CustomerProfile {
  id: string
  auth_user_id: string
  first_name: string
  last_name: string
  email: string
  scancode: string
  balance: number
  location_id: string | null
  created_at: string
}

interface AuthState {
  user: User | null
  session: Session | null
  customerProfile: CustomerProfile | null
  loading: boolean
  needsProfileSetup: boolean

  initialize: () => Promise<void>
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  completeProfileSetup: (firstName: string, lastName: string) => Promise<{ error: string | null }>
  fetchCustomerProfile: (userId: string) => Promise<CustomerProfile | null>
}

const generateScancode = () =>
  Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString()

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  customerProfile: null,
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
      } else {
        set({ user: null, session: null, customerProfile: null, needsProfileSetup: false })
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

  signUp: async (email, password, firstName, lastName) => {
    // Try to create a new auth account
    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      // If email already exists, Supabase returns a specific error
      // Try signing them in instead — existing operator becoming a customer
      if (error.message.toLowerCase().includes('already registered') ||
          error.message.toLowerCase().includes('user already exists')) {
        return get().signIn(email, password)
      }
      return { error: error.message }
    }

    if (!data.user) return { error: 'Signup failed. Please try again.' }

    // Create the customer profile
    const scancode = generateScancode()
    const { error: profileError } = await supabase
      .from('customers')
      .insert({
        auth_user_id: data.user.id,
        first_name: firstName,
        last_name: lastName,
        email: email,
        scancode,
        balance: 0.00,
      })

    if (profileError) return { error: profileError.message }
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
    }
    return { error: null }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, customerProfile: null, needsProfileSetup: false })
  },

  completeProfileSetup: async (firstName, lastName) => {
    const { user } = get()
    if (!user) return { error: 'Not authenticated' }

    const scancode = generateScancode()
    const { data, error } = await supabase
      .from('customers')
      .insert({
        auth_user_id: user.id,
        first_name: firstName,
        last_name: lastName,
        email: user.email,
        scancode,
        balance: 0.00,
      })
      .select()
      .single()

    if (error) return { error: error.message }

    set({ customerProfile: data as CustomerProfile, needsProfileSetup: false })
    return { error: null }
  },
}))

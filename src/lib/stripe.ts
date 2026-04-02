/**
 * Stripe.js singleton for plusdine-app
 *
 * loadStripe() must be called outside of any render cycle — calling it inside
 * a component causes a new Stripe object on every render and breaks the SDK.
 *
 * We use the platform (KnowStores LLC) publishable key here.
 * All payments are destination charges: the PaymentIntent lives on the platform
 * account and Stripe automatically transfers to the operator's connected account
 * minus the application fee. The frontend does not need to know the operator's
 * account ID.
 *
 * Add to plusdine-app .env.local:
 *   VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...   (test)
 *   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...   (production)
 */

import { loadStripe } from '@stripe/stripe-js'

export const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string
)

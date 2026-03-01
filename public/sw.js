const CACHE = 'plusdine-v2'
const APP_SHELL = [
  '/',
  '/index.html',
]

// Install — cache only the app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

// Activate — clear old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch — only intercept navigation requests for the app shell
// Let ALL other requests (Supabase, fonts, assets) pass through untouched
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // Never touch API calls — let them go directly to the network
  if (
    url.hostname.includes('supabase.co') ||
    url.protocol === 'chrome-extension:' ||
    e.request.method !== 'GET'
  ) {
    return
  }

  // For navigation requests, serve index.html from cache (SPA routing)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('/index.html').then(cached => cached || fetch(e.request))
    )
    return
  }

  // For everything else (JS/CSS assets), network first, no caching
  // This prevents the clone() error entirely
})

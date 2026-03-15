const CACHE = 'plusdine-v3'
const APP_SHELL = [
  '/',
  '/index.html',
]

// Install — cache the app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(APP_SHELL))
  )
  self.skipWaiting()
})

// Activate — clear ALL old caches immediately
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => {
        console.log('[SW] Deleting old cache:', k)
        return caches.delete(k)
      }))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // Never intercept API calls, non-GET, or external URLs
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('square') ||
    url.protocol === 'chrome-extension:' ||
    e.request.method !== 'GET' ||
    url.origin !== self.location.origin
  ) {
    return
  }

  // Navigation requests (page loads): NETWORK FIRST, cache fallback
  // This ensures fresh index.html after every deploy.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // Update cache with fresh response
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put('/index.html', clone))
          return res
        })
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // Static assets (JS/CSS with hash names): cache first, then network
  // These are immutable once deployed so cache is always valid.
  if (url.pathname.match(/\.(js|css|png|svg|ico|woff2?)(\?.*)?$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
          return res
        })
      })
    )
    return
  }
})

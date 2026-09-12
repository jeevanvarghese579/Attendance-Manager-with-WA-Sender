const CACHE_NAME = 'attendance-shell-v4.1.1'
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png?v=4.0.0',
  '/icons/icon-512.png?v=4.0.0',
]

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    const htmlResponse = await fetch('/index.html')
    const html = await htmlResponse.clone().text()
    await cache.put('/index.html', htmlResponse)
    const builtAssets = [...html.matchAll(/(?:src|href)="(\/[^"?#]+(?:\?[^"#]*)?)"/g)]
      .map((match) => match[1])
      .filter((path) => !path.startsWith('//'))
    await cache.addAll([...new Set([...APP_SHELL.filter((path) => path !== '/index.html'), ...builtAssets])])
  })())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
  )))
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone()
      caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy))
      return response
    }).catch(() => caches.match('/index.html')))
    return
  }

  if (['script', 'style', 'font', 'image', 'manifest'].includes(request.destination)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
      return response
    })))
  }
})

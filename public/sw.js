// Service worker de Memoa : rend le site installable et garde la coquille de l'application pour s'ouvrir même sans réseau.
// Les données (cours, notes, IA) ne sont JAMAIS mises en cache ici : elles viennent toujours du serveur.
const CACHE = 'memoa-shell-v2'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET') return
  // Polices Google (Sora) : gardées pour que l'appli garde son allure hors connexion.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((res) => {
          if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
          return res
        }).catch(() => hit)
        return hit || net
      })
    )
    return
  }
  if (url.origin !== self.location.origin) return
  // Pages : le réseau d'abord (toujours la dernière version), le cache en secours hors connexion.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy))
        return res
      }).catch(() => caches.match(req).then((r) => r || caches.match('./')))
    )
    return
  }
  // Fichiers du site (scripts, styles, images) : cache d'abord, mis à jour en arrière-plan.
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
        return res
      }).catch(() => hit)
      return hit || net
    })
  )
})

// À la première ouverture, la page envoie la liste de ses fichiers : on les garde tout de suite,
// pour que l'appli démarre sans réseau dès la deuxième ouverture (et pas seulement après plusieurs visites).
self.addEventListener('message', (e) => {
  const d = e.data
  if (!d || d.type !== 'precache' || !Array.isArray(d.urls)) return
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(
        d.urls.map((u) => {
          try {
            const url = new URL(String(u), self.location.href)
            if (url.origin !== self.location.origin) return null
            return c.add(new Request(url.href)).catch(() => {})
          } catch (_) {
            return null
          }
        })
      )
    )
  )
})

// Notifications « Le savais-tu ? » et rappels de brouillons : le serveur envoie un petit message, on l'affiche, et un toucher ouvre Memoa.
self.addEventListener('push', (e) => {
  let data = {}
  try { data = e.data ? e.data.json() : {} } catch (_) { data = {} }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Memoa', {
      body: data.body || '',
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: data.tag || 'memoa-savais-tu',
      vibrate: [200, 100, 200],
      renotify: true,
      data: { url: data.url || './' }
    })
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const target = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus()
      }
      return self.clients.openWindow(target)
    })
  )
})

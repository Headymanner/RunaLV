const CACHE = 'lv-tutor-v2';
const ASSETS = [
  './preview.html',
  './manifest.json'
];

// Install - cache core assets
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', function(e) {
  // Don't intercept API calls
  if (e.request.url.includes('googleapis.com') || 
      e.request.url.includes('fonts.google')) {
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(function(resp) {
        // Cache successful responses for app files
        if (resp.ok && e.request.url.includes('preview.html')) {
          var clone = resp.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return resp;
      })
      .catch(function() {
        return caches.match(e.request);
      })
  );
});

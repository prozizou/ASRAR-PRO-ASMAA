// sw.js — Mode 100% Online (Network Only)

self.addEventListener('install', event => {
    // Force le nouveau Service Worker à s'activer tout de suite
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    // 🧹 LE GRAND NETTOYAGE : On détruit TOUS les caches existants !
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    console.log('Ancien cache détruit :', cache);
                    return caches.delete(cache);
                })
            );
        }).then(() => self.clients.claim()) // Prend le contrôle de la page immédiatement
    );
});

self.addEventListener('fetch', event => {
    // 🌐 STRATÉGIE "NETWORK ONLY"
    // On ignore complètement le cache, on télécharge toujours la version en direct
    event.respondWith(
        fetch(event.request)
    );
});
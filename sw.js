// sw.js — v3.0 (Stratégie "Network First" - Le réseau en priorité)

const CACHE_NAME = 'asrar-pro-cache-v3';

// Fichiers vitaux à mettre en mémoire lors de la première installation
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/login.html',
    '/style.css',
    '/app.js',
    '/domManager.js',
    '/abjad.js',
    '/tasbihLogic.js',
    '/audio.js',
    '/firebase.js',
    '/login.js',
    '/manifest.json'
];

// 1. INSTALLATION : Pré-chargement du cache
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Mise en cache initiale...');
            return cache.addAll(ASSETS_TO_CACHE);
        }).catch(err => console.warn('Erreur de mise en cache:', err))
    );
});

// 2. ACTIVATION : Nettoyage des vieilles versions
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(keys.map(key => {
                if (key !== CACHE_NAME) {
                    console.log('Ancien cache détruit :', key);
                    return caches.delete(key);
                }
            }));
        }).then(() => self.clients.claim())
    );
});

// 3. INTERCEPTION (Fetch) : Stratégie "Network First"
self.addEventListener('fetch', event => {
    // 🔴 SÉCURITÉ ABSOLUE : On ordonne au cache d'ignorer totalement Firebase et l'Authentification
    if (
        event.request.method !== 'GET' || 
        event.request.url.includes('firebaseio.com') || // Ignore la base de données en temps réel
        event.request.url.includes('firestore') || 
        event.request.url.includes('googleapis.com') || // Ignore Google Auth
        event.request.url.includes('gstatic.com')
    ) {
        return; // Laisse la requête passer en direct vers internet
    }

    event.respondWith(
        fetch(event.request).then(networkResponse => {
            return caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, networkResponse.clone());
                return networkResponse;
            });
        }).catch(() => {
            console.log('Mode hors-ligne activé pour :', event.request.url);
            return caches.match(event.request);
        })
    );
});

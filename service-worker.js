// service-worker.js - Provides offline capabilities and caching strategies

const CACHE_NAME = 'ar-project-impact-cache-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/main.js',
    '/script.js',
    '/utils.js',
    '/config.js',
    '/analytics.js',
    '/domUtils.js',
    '/style.css',
    '/src/input.css',
    '/forest/forestMain.js',
    '/forest/forestCalcs.js',
    '/forest/forestDOM.js',
    '/forest/forestEnhanced.js',
    '/forest/forestIO.js'
];

// Additional assets that can be cached when visited
const DYNAMIC_CACHE_NAME = 'ar-project-impact-dynamic-cache-v1';

// Install event - cache all static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(name => {
                    if (name !== CACHE_NAME && name !== DYNAMIC_CACHE_NAME) {
                        console.log('Deleting old cache:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Network-first strategy with cache fallback for API requests
async function networkFirstWithCacheFallback(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);
        
        // If successful, clone and cache
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(DYNAMIC_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Network failed, try cache
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // If no cache and network failed, throw error
        throw error;
    }
}

// Cache-first strategy for static assets
async function cacheFirstWithNetworkFallback(request) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        // Not in cache, fetch from network
        const networkResponse = await fetch(request);
        
        // If successful, cache for future use
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Both cache and network failed
        console.error('Failed to fetch resource:', error);
        throw error;
    }
}

// Main fetch event - select strategy based on request type
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    // Skip browser extension requests
    if (!(url.protocol === 'http:' || url.protocol === 'https:')) {
        return;
    }
    
    // Choose strategy based on request type
    if (event.request.url.includes('/api/')) {
        // API requests - network first with cache fallback
        event.respondWith(networkFirstWithCacheFallback(event.request));
    } else if (
        // Static assets - cache first with network fallback
        STATIC_ASSETS.some(asset => event.request.url.endsWith(asset)) ||
        event.request.url.endsWith('.css') ||
        event.request.url.endsWith('.js') ||
        event.request.url.endsWith('.html') ||
        event.request.url.endsWith('.png') ||
        event.request.url.endsWith('.jpg') ||
        event.request.url.endsWith('.svg')
    ) {
        event.respondWith(cacheFirstWithNetworkFallback(event.request));
    } else {
        // Default - network with cache fallback
        event.respondWith(networkFirstWithCacheFallback(event.request));
    }
});

// Handle background sync (e.g., for analytics events)
self.addEventListener('sync', event => {
    if (event.tag === 'analytics-sync') {
        event.waitUntil(syncAnalytics());
    }
});

// Handle push notifications
self.addEventListener('push', event => {
    let notificationData = {};
    
    try {
        notificationData = event.data.json();
    } catch (e) {
        notificationData = {
            title: 'New Notification',
            body: event.data ? event.data.text() : 'No details available',
            icon: '/icons/notification-icon.png'
        };
    }
    
    const options = {
        body: notificationData.body || 'Something new happened!',
        icon: notificationData.icon || '/icons/notification-icon.png',
        badge: '/icons/badge-icon.png',
        data: notificationData.data || {}
    };
    
    event.waitUntil(
        self.registration.showNotification(
            notificationData.title || 'A-R Project Impact',
            options
        )
    );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({type: 'window'})
            .then(clientList => {
                // If a window already open, focus it
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                
                // Otherwise open new window
                if (clients.openWindow) {
                    const url = event.notification.data.url || '/';
                    return clients.openWindow(url);
                }
            })
    );
});

// Sync analytics events that couldn't be sent while offline
async function syncAnalytics() {
    try {
        const cache = await caches.open('analytics-cache');
        const requests = await cache.keys();
        
        const syncPromises = requests.map(async (request) => {
            try {
                const response = await fetch(request.clone());
                
                if (response.ok) {
                    return cache.delete(request);
                }
            } catch (error) {
                console.error('Failed to sync analytics:', error);
                // Leave in cache to retry later
            }
        });
        
        return Promise.all(syncPromises);
    } catch (error) {
        console.error('Analytics sync error:', error);
    }
}
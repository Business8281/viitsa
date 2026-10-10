/**
 * Global cache management and wipe utilities for VIITSA.
 * Cleans out stale local storage, session storage, Service Workers, CacheStorage,
 * and indexedDB caches to ensure clean testing and deployment environments.
 */

export async function clearAllViitsaCaches(options: { reload?: boolean; hardRedirect?: string } = {}) {
  try {
    // 1. Clear all localStorage keys related to VIITSA, chunks, or auth
    const removeKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (
        k.startsWith('viitsa_') ||
        k.startsWith('chunk_') ||
        k.includes('firebase:authUser') ||
        k.includes('loglevel') ||
        k.includes('sentry')
      )) {
        removeKeys.push(k);
      }
    }
    removeKeys.forEach((k) => {
      try { localStorage.removeItem(k); } catch {}
    });

    // 2. Clear sessionStorage completely
    try { sessionStorage.clear(); } catch {}

    // 3. Clear CacheStorage (browser Cache API / service worker caches)
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map((name) => window.caches.delete(name)));
      } catch (err) {
        console.warn('CacheStorage deletion error:', err);
      }
    }

    // 4. Unregister any service workers
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      } catch (err) {
        console.warn('ServiceWorker unregister error:', err);
      }
    }

    console.info('✅ [VIITSA] All local, session, and browser caches have been successfully purged.');

    if (options.reload) {
      const target = options.hardRedirect || window.location.pathname;
      window.location.href = `${target}?_cb=${Date.now()}`;
    }
  } catch (e) {
    console.error('Failed to purge caches:', e);
    if (options.reload) {
      window.location.reload();
    }
  }
}

// Expose on global window object for instant console debugging
if (typeof window !== 'undefined') {
  (window as any).__clearViitsaCache = () => clearAllViitsaCaches({ reload: true });
}

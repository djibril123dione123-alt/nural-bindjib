// ============================================================
// sw.js — Service Worker Nur Al-BinDjib v2
// Cache-first pour assets statiques + polices
// Background sync pour notifications Adhan
// Optimisé réseau instable (Dakar)
// ============================================================

const CACHE_NAME = "nural-bindjib-v2";

// Assets critiques pour le mode hors-ligne
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
];

// ─── Installation ────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).catch((err) => {
      console.warn("[SW] Cache install error (non-fatal):", err);
    })
  );
  self.skipWaiting();
});

// ─── Activation — supprime les vieux caches ──────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch — Stale-While-Revalidate pour assets statiques ────
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Ne pas intercepter Supabase ni audio (everyayah.com)
  if (
    url.hostname.includes("supabase") ||
    url.hostname.includes("everyayah") ||
    url.hostname.includes("islamic.network") ||
    url.pathname.startsWith("/api")
  ) return;

  // Polices Google — cache-first longue durée
  if (url.hostname.includes("fonts.googleapis") || url.hostname.includes("fonts.gstatic")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const fresh = await fetch(event.request);
        if (fresh.ok && fresh.type !== "opaque") {
          const copy = fresh.clone();
          try {
            await cache.put(event.request, copy);
          } catch {
            /* ignore cache errors */
          }
        }
        return fresh;
      }).catch(() => new Response("", { status: 503 }))
    );
    return;
  }

  // Assets statiques — cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (!response.ok || response.type === "opaque") return response;
          const forCache = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) =>
              cache.put(event.request, forCache).catch(() => {})
            )
          );
          return response;
        })
        .then((r) => r || caches.match("/index.html"))
        .catch(() => caches.match("/index.html"));
    })
  );
});

// ─── Push notifications ──────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try { data = event.data.json(); }
  catch { data = { title: "Nur Al-BinDjib", body: event.data.text() }; }

  const options = {
    body:    data.body || "",
    icon:    "/favicon.ico",
    badge:   "/favicon.ico",
    tag:     data.tag || "general",
    data:    { url: data.url || "/" },
    vibrate: data.vibrate || [100, 50, 100],
    silent:  false,
  };

  if (data.type === "adhan") {
    options.requireInteraction = true;
    options.vibrate = [200, 100, 200, 100, 200];
  } else if (data.type === "penalty") {
    options.vibrate = [300, 100, 300];
  } else if (data.type === "levelup") {
    options.vibrate = [50, 30, 50, 30, 100];
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Nur Al-BinDjib", options)
  );
});

// ─── Clic notification ───────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

// ─── Messages depuis l'app ───────────────────────────────────
const scheduledTimers = [];

self.addEventListener("message", (event) => {
  const { type, payload } = event.data || {};

  if (type === "SCHEDULE_ADHAN") {
    scheduleAdhan(payload.prayers);
  }

  if (type === "SEND_NOTIFICATION") {
    self.registration.showNotification(payload.title, {
      body:    payload.body,
      icon:    "/favicon.ico",
      badge:   "/favicon.ico",
      tag:     payload.tag || "duo-sync",
      data:    { url: payload.url || "/" },
      vibrate: [100, 50, 100],
    });
  }
});

// ─── Scheduling Adhan ────────────────────────────────────────
function scheduleAdhan(prayers) {
  scheduledTimers.forEach((t) => clearTimeout(t));
  scheduledTimers.length = 0;

  if (!prayers || !Array.isArray(prayers)) return;
  const now = Date.now();

  prayers.forEach(({ name, time }) => {
    const [h, m]     = time.split(":").map(Number);
    const prayerDate = new Date();
    prayerDate.setHours(h, m, 0, 0);
    const prayerMs = prayerDate.getTime();

    // Rappel 20 min avant
    const reminderMs = prayerMs - 20 * 60 * 1000;
    if (reminderMs > now) {
      scheduledTimers.push(setTimeout(() => {
        self.registration.showNotification("⏰ Rappel Prière", {
          body:    `Le temps du Woudou approche pour ${name}`,
          icon:    "/favicon.ico",
          tag:     `adhan-reminder-${name}`,
          data:    { url: "/" },
          vibrate: [100],
        });
      }, reminderMs - now));
    }

    // Adhan à l'heure exacte
    if (prayerMs > now) {
      scheduledTimers.push(setTimeout(() => {
        self.registration.showNotification(`🕌 ${name} — Allahu Akbar`, {
          body:                `Il est l'heure de la prière de ${name}. Que Allah accepte.`,
          icon:                "/favicon.ico",
          tag:                 `adhan-${name}`,
          data:                { url: "/" },
          requireInteraction:  true,
          vibrate:             [200, 100, 200, 100, 200],
        });
      }, prayerMs - now));
    }
  });
}

// ============================================================
// NUR AL-BINDJIB — Service Worker v1.0
// Adhan automatique, notifications background, cache offline
// ============================================================

const CACHE_NAME = "nural-bindjib-v3";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
];

// ─── Installation ────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

// ─── Activation ──────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch (cache-first pour les assets) ────────────────────
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isStaticAsset = ["style", "script", "image", "font"].includes(event.request.destination);
  if (url.pathname.startsWith("/api") || url.hostname.includes("supabase")) return;

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (!response.ok || response.type !== "basic") return response;
            const forCache = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then((c) => c.put(event.request, forCache).catch(() => {}))
            );
            return response;
          })
          .catch(() => new Response("", { status: 503 }));
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const forCache = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((c) => c.put(event.request, forCache).catch(() => {}))
          );
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) =>
          cached || (event.request.mode === "navigate" ? caches.match("/index.html") : new Response("", { status: 503 }))
        )
      )
  );
});

// ─── Notifications push ──────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Nur Al-BinDjib", body: event.data.text() };
  }

  const options = {
    body: data.body || "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.tag || "general",
    data: { url: data.url || "/" },
    vibrate: data.vibrate || [100, 50, 100],
    silent: data.silent || false,
  };

  // Son personnalisé selon le type
  if (data.type === "adhan") {
    options.tag = "adhan";
    options.requireInteraction = true;
    options.vibrate = [200, 100, 200, 100, 200];
  } else if (data.type === "levelup") {
    options.vibrate = [50, 50, 50];
  }

  event.waitUntil(self.registration.showNotification(data.title || "Nur Al-BinDjib", options));
});

// ─── Clic sur notification ───────────────────────────────────
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
self.addEventListener("message", (event) => {
  const { type, payload } = event.data || {};

  // Programmer les notifications Adhan pour la journée
  if (type === "SCHEDULE_ADHAN") {
    scheduleAdhanNotifications(payload.prayers);
  }

  // Notification duo (encouragement, level up, etc.)
  if (type === "SEND_NOTIFICATION") {
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: payload.tag || "duo-sync",
      data: { url: payload.url || "/" },
      vibrate: [100, 50, 100],
    });
  }
});

// ─── Scheduling Adhan ────────────────────────────────────────
const scheduledTimers = [];

function scheduleAdhanNotifications(prayers) {
  // Annuler les anciens timers
  scheduledTimers.forEach((t) => clearTimeout(t));
  scheduledTimers.length = 0;

  if (!prayers || !Array.isArray(prayers)) return;

  const now = Date.now();

  prayers.forEach((prayer) => {
    const { name, time } = prayer;
    const [h, m] = time.split(":").map(Number);
    const prayerDate = new Date();
    prayerDate.setHours(h, m, 0, 0);
    const prayerMs = prayerDate.getTime();

    // T-20 min : Rappel doux
    const reminderMs = prayerMs - 20 * 60 * 1000;
    if (reminderMs > now) {
      const t = setTimeout(() => {
        self.registration.showNotification("⏰ Rappel Prière", {
          body: `Le temps du Woudou et du Coran approche pour ${name}`,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: `adhan-reminder-${name}`,
          data: { url: "/" },
          silent: false,
          vibrate: [100],
        });
      }, reminderMs - now);
      scheduledTimers.push(t);
    }

    // À l'heure exacte : Adhan prioritaire
    if (prayerMs > now) {
      const t = setTimeout(() => {
        self.registration.showNotification(`🕌 ${name} — Allahu Akbar`, {
          body: `Il est l'heure de la prière de ${name}. Que Allah accepte.`,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: `adhan-${name}`,
          data: { url: "/", type: "adhan", prayer: name },
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200],
          silent: false,
        });
      }, prayerMs - now);
      scheduledTimers.push(t);
    }
  });
}

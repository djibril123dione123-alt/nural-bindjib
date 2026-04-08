// ============================================================
// NUR AL-BINDJIB — Service Worker v2.0 — PRODUCTION DAKAR
// Stratégie cache complète : static, fonts, dynamic, SPA fallback
// ============================================================

const CACHE_VERSION = "v2";
const CACHE_STATIC  = `nural-bindjib-static-${CACHE_VERSION}`;
const CACHE_FONTS   = `nural-bindjib-fonts-${CACHE_VERSION}`;
const CACHE_DYNAMIC = `nural-bindjib-dynamic-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
];

const FONT_URLS = [
  "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@800;900&family=Space+Mono:wght@700&display=swap",
];

// Toujours réseau — jamais cachés
const NETWORK_ONLY = [
  "supabase.co",
  "everyayah.com",
  "cdn.islamic.network",
  "api.anthropic.com",
];

// ─── Installation ────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_STATIC).then((cache) =>
        cache.addAll(PRECACHE_URLS).catch((err) =>
          console.warn("[SW] Pré-cache partiel :", err)
        )
      ),
      caches.open(CACHE_FONTS).then((cache) =>
        Promise.all(
          FONT_URLS.map((url) =>
            fetch(url, { mode: "cors" })
              .then((res) => { if (res.ok) cache.put(url, res); })
              .catch(() => {})
          )
        )
      ),
    ])
  );
  self.skipWaiting();
});

// ─── Activation ──────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  const CURRENT = [CACHE_STATIC, CACHE_FONTS, CACHE_DYNAMIC];
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !CURRENT.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ───────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // 1. Toujours réseau pour Supabase / audio Coran
  if (NETWORK_ONLY.some((h) => url.hostname.includes(h))) return;

  // 2. Google Fonts → Cache-first
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.open(CACHE_FONTS).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const res = await fetch(event.request);
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        } catch {
          return new Response("/* font offline */", { headers: { "Content-Type": "text/css" } });
        }
      })
    );
    return;
  }

  // 3. Assets Vite (/assets/*) → Cache-first (immutables via hash)
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(CACHE_STATIC).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const res = await fetch(event.request);
          if (res.ok) cache.put(event.request, res.clone());
          return res;
        } catch {
          return new Response("", { status: 503 });
        }
      })
    );
    return;
  }

  // 4. Navigation → Network-first avec fallback SPA
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) caches.open(CACHE_STATIC).then((c) => c.put("/index.html", res.clone()));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match("/index.html");
          return (
            cached ||
            new Response(
              `<!doctype html><html><head><meta charset="UTF-8"><title>Nur Al-BinDjib — Hors-ligne</title></head>
              <body style="background:#000;color:#F59E0B;font-family:monospace;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px">
              <div style="font-size:48px">🕌</div>
              <p style="font-size:18px;font-weight:bold">Nur Al-BinDjib</p>
              <p style="color:#888;font-size:12px">Hors-ligne — L'Alliance attend ton retour</p>
              </body></html>`,
              { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
            )
          );
        })
    );
    return;
  }

  // 5. Tout le reste → Stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_DYNAMIC).then(async (cache) => {
      const cached = await cache.match(event.request);
      const fetchPromise = fetch(event.request)
        .then((res) => {
          if (res.ok && res.type !== "opaque") cache.put(event.request, res.clone());
          return res;
        })
        .catch(() => cached || new Response("", { status: 503 }));
      return cached || fetchPromise;
    })
  );
});

// ─── Messages depuis l'app ───────────────────────────────────
self.addEventListener("message", (event) => {
  const { type, payload } = event.data || {};

  if (type === "SCHEDULE_ADHAN") {
    scheduleAdhanNotifications(payload.prayers);
  }

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

  if (type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ─── Push notifications ──────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); }
  catch { data = { title: "Nur Al-BinDjib", body: event.data.text() }; }

  const options = {
    body: data.body || "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.tag || "general",
    data: { url: data.url || "/" },
    vibrate: [100, 50, 100],
    silent: false,
  };

  if (data.type === "adhan") {
    options.tag = "adhan";
    options.requireInteraction = true;
    options.vibrate = [200, 100, 200, 100, 200];
  } else if (data.type === "levelup") {
    options.vibrate = [50, 50, 50, 150, 300];
  } else if (data.type === "penalty") {
    options.tag = "midnight-penalty";
    options.requireInteraction = true;
    options.vibrate = [300, 100, 300];
  }

  event.waitUntil(self.registration.showNotification(data.title || "Nur Al-BinDjib", options));
});

// ─── Clic notification ───────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(targetUrl);
          return;
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

// ─── Scheduling Adhan (Dakar UTC+0) ─────────────────────────
const scheduledTimers = [];

function scheduleAdhanNotifications(prayers) {
  scheduledTimers.forEach((t) => clearTimeout(t));
  scheduledTimers.length = 0;

  if (!Array.isArray(prayers)) return;
  const now = Date.now();

  prayers.forEach(({ name, time }) => {
    if (!name || !time) return;
    const [h, m] = time.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return;

    const prayerDate = new Date();
    prayerDate.setHours(h, m, 0, 0);
    const prayerMs = prayerDate.getTime();

    // T-20 min
    const reminderAt = prayerMs - 20 * 60 * 1000;
    if (reminderAt > now) {
      scheduledTimers.push(setTimeout(() => {
        self.registration.showNotification(`⏰ ${name} dans 20 min`, {
          body: `Prépare-toi : Woudou et Coran avant ${name}`,
          icon: "/favicon.ico", badge: "/favicon.ico",
          tag: `adhan-reminder-${name}`,
          data: { url: "/tazkiyah" },
          vibrate: [100, 50, 100],
        });
      }, reminderAt - now));
    }

    // À l'heure exacte
    if (prayerMs > now) {
      scheduledTimers.push(setTimeout(() => {
        self.registration.showNotification(`🕌 ${name} — Allahu Akbar`, {
          body: `Il est l'heure de ${name}. Que Allah accepte.`,
          icon: "/favicon.ico", badge: "/favicon.ico",
          tag: `adhan-${name}`,
          data: { url: "/tazkiyah", type: "adhan" },
          requireInteraction: true,
          vibrate: [200, 100, 200, 100, 200],
        });
      }, prayerMs - now));
    }
  });

  console.log(`[SW Dakar] ${scheduledTimers.length} timers Adhan actifs`);
}

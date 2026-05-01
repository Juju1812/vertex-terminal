const CACHE_NAME = "arbibx-v4";

const PRECACHE = [
  "/",
  "/manifest.json",
  "/logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (
    url.hostname.includes("polygon.io") ||
    url.hostname.includes("anthropic.com") ||
    url.hostname.includes("supabase.co") ||
    url.pathname.startsWith("/api/")
  ) return;

  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (!res || res.status !== 200 || res.type !== "basic") return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        return res;
      });
    })
  );
});

/* ---- Push notifications ------------------------------------ */
self.addEventListener("push", (event) => {
  let data = { title: "ArbibX Alert", body: "A price alert has triggered.", url: "/" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch { /**/ }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    "/logo.png",
      badge:   "/logo.png",
      tag:     "arbibx-alert",
      data:    { url: data.url },
      vibrate: [200, 100, 200],
      actions: [
        { action: "view",    title: "View in ArbibX" },
        { action: "dismiss", title: "Dismiss" },
      ],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});

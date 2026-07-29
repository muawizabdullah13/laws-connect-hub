// ZLC Digital service worker
// Plain-language: this small script runs in the background, separately from
// the app itself, so your phone can receive and show a notification even if
// ZLC Digital isn't open at the time.

self.addEventListener("push", (event) => {
  let payload = { title: "ZLC Digital", body: "", url: "/" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // fall back to defaults if the payload isn't JSON for some reason
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  // Always open a fresh tab for the linked judgment, rather than navigating
  // an already-open ZLC Digital tab away from wherever the person was in
  // the app — so tapping a notification never loses their place.
  event.waitUntil(clients.openWindow(targetUrl));
});

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => new Response("网络不可用，请重新连接后再操作库存。", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })));
});

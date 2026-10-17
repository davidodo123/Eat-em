// Service worker de Eat-em: notificaciones push (Web Push con VAPID).
// El servidor envia JSON: { titulo, cuerpo, url, etiqueta }.
self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { cuerpo: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(datos.titulo || "Eat-em", {
      body: datos.cuerpo || "",
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: datos.etiqueta || undefined,
      data: { url: datos.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if (v.url === destino && "focus" in v) return v.focus();
      }
      return self.clients.openWindow(destino);
    }),
  );
});

// Solo se aceptan endpoints de los servicios de Web Push de los navegadores: evita que un
// usuario haga que el servidor envie peticiones a una URL cualquiera (SSRF).
const SERVICIOS_PUSH = [
  /^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/,          // Chrome, Edge (Android), Opera
  /^updates\.push\.services\.mozilla\.com$/,                        // Firefox
  /^web\.push\.apple\.com$/,                                        // Safari (iOS 16.4+ y macOS)
  /\.notify\.windows\.com$/,                                        // Edge (Windows)
];

export function endpointPushValido(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && !u.port && SERVICIOS_PUSH.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

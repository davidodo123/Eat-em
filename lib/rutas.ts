// Solo se aceptan redirecciones a rutas internas ("/inventario"), nunca a otro dominio
// ("//evil.com", "https://..."): evita redirecciones abiertas en el login.
export function rutaInterna(ruta: string | null | undefined, porDefecto = "/") {
  if (!ruta || !ruta.startsWith("/") || ruta.startsWith("//") || ruta.startsWith("/\\")) return porDefecto;
  return ruta;
}

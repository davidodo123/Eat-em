"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const PESTANAS = [
  { href: "/hoy", texto: "Hoy", icono: "☀️" },
  { href: "/dieta", texto: "Semana", icono: "🗓️" },
  { href: "/lista", texto: "Lista", icono: "🛒" },
  { href: "/inventario", texto: "Despensa", icono: "🥫" },
  { href: "/", texto: "Más", icono: "☰" },
];
const SIN_BARRA = ["/entrar", "/auth"];

// Barra inferior para el movil (PWA). "Mas" lleva a la portada con el resto de pantallas.
export function Navegacion() {
  const ruta = usePathname();
  if (SIN_BARRA.some((r) => ruta.startsWith(r))) return null;
  const activa = (href: string) => (href === "/" ? !PESTANAS.slice(0, -1).some((p) => ruta.startsWith(p.href)) : ruta.startsWith(href));
  return (
    <nav aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-borde bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {PESTANAS.map((p) => (
          <li key={p.href}>
            <Link href={p.href} aria-current={activa(p.href) ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-xs ${activa(p.href) ? "font-semibold text-marca" : "text-texto-suave"}`}>
              <span aria-hidden className="text-lg leading-none">{p.icono}</span>{p.texto}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

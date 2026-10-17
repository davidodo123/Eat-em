"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONO = {
  lista: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  despensa: <path d="M5 3h14v18H5zM5 9h14M5 15h14M10 6h4M10 12h4M10 18h4" />,
  dieta: <path d="M4 5h16v15H4zM4 10h16M9 3v4M15 3v4M8 14h2M14 14h2" />,
  ajustes: <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7.5 7.5 0 0 1-2.1 1.2L14.7 21h-4l-.3-2.4a7.5 7.5 0 0 1-2.1-1.2l-1.9.7-2-3.4 1.6-1.2a7.6 7.6 0 0 1 0-2.4L4.4 9.9l2-3.4 1.9.7a7.5 7.5 0 0 1 2.1-1.2L10.7 3h4l.3 2.4a7.5 7.5 0 0 1 2.1 1.2l1.9-.7 2 3.4-1.6 1.2a7.6 7.6 0 0 1 0 2.4Z" />,
};

const PESTANAS = [
  { href: "/lista", texto: "Lista", icono: ICONO.lista, tambien: [] },
  { href: "/despensa", texto: "Despensa", icono: ICONO.despensa, tambien: ["/escanear"] },
  { href: "/dieta", texto: "Dieta", icono: ICONO.dieta, tambien: ["/perfil", "/nutriem"] },
  { href: "/ajustes", texto: "Ajustes", icono: ICONO.ajustes, tambien: ["/grupo", "/ubicacion", "/comparar"] },
];
const SIN_BARRA = ["/entrar", "/auth"];

// Barra inferior de la app movil: Lista · Despensa · Dieta · Ajustes
export function Navegacion() {
  const ruta = usePathname();
  if (SIN_BARRA.some((r) => ruta.startsWith(r))) return null;
  const activa = (p: (typeof PESTANAS)[number]) => [p.href, ...p.tambien].some((h) => ruta.startsWith(h));
  return (
    <nav aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-borde bg-superficie/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {PESTANAS.map((p) => {
          const on = activa(p);
          return (
            <li key={p.href}>
              <Link href={p.href} aria-current={on ? "page" : undefined}
                className={`flex flex-col items-center gap-1 pb-1.5 pt-2 text-[0.7rem] font-medium ${on ? "text-marca" : "text-texto-suave"}`}>
                <svg viewBox="0 0 24 24" aria-hidden className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={on ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
                  {p.icono}
                </svg>
                {p.texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

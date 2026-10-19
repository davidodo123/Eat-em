"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const PESTANAS = [
  { href: "/lista", texto: "Lista", tambien: [] },
  { href: "/despensa", texto: "Despensa", tambien: ["/escanear"] },
  { href: "/dieta", texto: "Dieta", tambien: ["/perfil", "/nutriem"] },
  { href: "/ajustes", texto: "Ajustes", tambien: ["/grupo", "/ubicacion", "/comparar"] },
];
const SIN_BARRA = ["/entrar", "/auth"];

// Barra inferior solo con texto: la pestaña activa lleva una raya encima
export function Navegacion() {
  const ruta = usePathname();
  if (SIN_BARRA.some((r) => ruta.startsWith(r))) return null;
  const activa = (p: (typeof PESTANAS)[number]) => [p.href, ...p.tambien].some((h) => ruta.startsWith(h));
  return (
    <nav aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-borde bg-fondo/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <ul className="mx-auto grid max-w-md grid-cols-4 px-3">
        {PESTANAS.map((p) => {
          const on = activa(p);
          return (
            <li key={p.href}>
              <Link href={p.href} aria-current={on ? "page" : undefined}
                className={`relative block py-4 text-center text-[0.9rem] tracking-tight ${on ? "font-bold text-texto" : "font-medium text-texto-suave"}`}>
                <span aria-hidden className={`absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-marca transition-opacity ${on ? "opacity-100" : "opacity-0"}`} />
                {p.texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

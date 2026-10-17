// Piezas comunes de las pantallas de la app movil (servidor y cliente).
import Link from "next/link";

export function Pantalla({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <main className={`mx-auto min-h-dvh max-w-md px-4 pb-28 pt-[max(env(safe-area-inset-top),0.75rem)] ${className}`}>{children}</main>;
}

// Titulo grande al estilo de las apps nativas, con accion opcional a la derecha
export function Cabecera({ titulo, sub, accion, volver }: {
  titulo: string; sub?: React.ReactNode; accion?: React.ReactNode; volver?: { href: string; texto: string };
}) {
  return (
    <header className="mb-4 pt-2">
      {volver && <Link href={volver.href} className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-marca">‹ {volver.texto}</Link>}
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-[2rem] font-bold leading-tight tracking-tight">{titulo}</h1>
        {accion}
      </div>
      {sub && <div className="mt-0.5 text-sm text-texto-suave">{sub}</div>}
    </header>
  );
}

export function Seccion({ titulo, children, extra }: { titulo?: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <section className="mb-5">
      {titulo && (
        <div className="mb-1.5 flex items-baseline justify-between px-1">
          <h2 className="text-[0.8rem] font-semibold uppercase tracking-wider text-texto-suave">{titulo}</h2>
          {extra}
        </div>
      )}
      {children}
    </section>
  );
}

export function Tarjeta({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-superficie shadow-[0_1px_0_var(--borde),0_1px_3px_rgb(0_0_0/0.04)] ${className}`}>{children}</div>;
}

export function Vacio({ icono, titulo, texto, children }: { icono: string; titulo: string; texto?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span aria-hidden className="mb-3 text-5xl">{icono}</span>
      <p className="text-lg font-semibold">{titulo}</p>
      {texto && <p className="mt-1 text-sm text-texto-suave">{texto}</p>}
      {children && <div className="mt-5 w-full">{children}</div>}
    </div>
  );
}

export function SinHogar({ que }: { que: string }) {
  return (
    <Vacio icono="🏠" titulo="Primero, tu hogar" texto={`${que} se comparte con quien vive contigo.`}>
      <Link href="/grupo" className="block rounded-2xl bg-marca px-4 py-3.5 font-semibold text-marca-texto">Crear hogar o unirme</Link>
    </Vacio>
  );
}

export const boton = "rounded-2xl bg-marca px-4 py-3.5 font-semibold text-marca-texto active:opacity-80 disabled:opacity-50";
export const botonSuave = "rounded-2xl bg-superficie px-4 py-3.5 font-semibold shadow-[0_1px_0_var(--borde)] active:opacity-80 disabled:opacity-50";
export const campo = "block w-full rounded-xl border border-borde bg-superficie px-3.5 py-3 text-base outline-none focus:border-marca";

export function euros(n: number | null | undefined) {
  return n === null || n === undefined ? "" : n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

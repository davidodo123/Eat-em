// Piezas comunes de las pantallas de la app movil (servidor y cliente). Sin iconos: todo tipografia.
import Link from "next/link";

export function Pantalla({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <main className={`mx-auto min-h-dvh max-w-md px-5 pb-28 pt-[max(env(safe-area-inset-top),0.75rem)] ${className}`}>{children}</main>;
}

// Titulo grande, con accion opcional a la derecha y enlace de vuelta encima
export function Cabecera({ titulo, sub, accion, volver }: {
  titulo: string; sub?: React.ReactNode; accion?: React.ReactNode; volver?: { href: string; texto: string };
}) {
  return (
    <header className="mb-5 pt-3">
      {volver && <Link href={volver.href} className="mb-2 inline-block text-sm font-semibold text-marca">← {volver.texto}</Link>}
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-titulo text-[2.15rem] font-bold leading-none tracking-[-0.03em]">{titulo}</h1>
        {accion}
      </div>
      {sub && <div className="mt-2 text-sm leading-snug text-texto-suave">{sub}</div>}
    </header>
  );
}

export function Seccion({ titulo, children, extra }: { titulo?: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <section className="mb-6">
      {titulo && (
        <div className="mb-2 flex items-baseline justify-between px-0.5">
          <h2 className="rotulo">{titulo}</h2>
          {extra}
        </div>
      )}
      {children}
    </section>
  );
}

export function Tarjeta({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`caja ${className}`}>{children}</div>;
}

export function Vacio({ titulo, texto, children }: { titulo: string; texto?: string; children?: React.ReactNode }) {
  return (
    <div className="caja border-dashed px-6 py-10 text-center">
      <p className="font-titulo text-xl font-bold tracking-tight">{titulo}</p>
      {texto && <p className="mx-auto mt-1.5 max-w-[30ch] text-sm text-texto-suave">{texto}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

export function SinHogar({ que }: { que: string }) {
  return (
    <Vacio titulo="Primero, tu hogar" texto={`${que} se comparte con quien vive contigo.`}>
      <Link href="/grupo" className={`${boton} block`}>Crear hogar o unirme</Link>
    </Vacio>
  );
}

// Boton secundario pequeno de texto (para cabeceras)
export function BotonTexto({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="rounded-full border border-borde bg-superficie px-3.5 py-1.5 text-sm font-semibold">{children}</Link>;
}

export const boton = "rounded-xl bg-marca px-4 py-3.5 text-center font-semibold text-marca-texto active:opacity-85 disabled:opacity-50";
export const botonSuave = "rounded-xl border border-borde bg-superficie px-4 py-3.5 text-center font-semibold active:bg-fondo disabled:opacity-50";
export const campo = "block w-full px-3.5 py-3 text-base";

export function euros(n: number | null | undefined) {
  return n === null || n === undefined ? "" : n.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

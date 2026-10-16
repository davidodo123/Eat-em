// Pantalla provisional (Fase 1). Las pantallas reales llegan en la Fase 7.
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/env";
import Link from "next/link";

const PANTALLAS = [
  { nombre: "Hoy", detalle: "Comidas del dia: marcar hecha, editar cantidad, saltar" },
  { nombre: "Inventario", detalle: "Stock del hogar y escaner de codigos de barras" },
  { nombre: "Lista", detalle: "Lista de la compra compartida, copiar para WhatsApp" },
  { nombre: "Dieta", detalle: "Plan semanal individual" },
  { nombre: "Grupo", detalle: "Hogar compartido, invitaciones y actividad" },
  { nombre: "Nutri-em", detalle: "Chat y consejos de psicologia de la dieta" },
  { nombre: "Ajustes", detalle: "Perfil, notificaciones y privacidad" },
];

export default async function Inicio() {
  const usuario = supabaseConfigurado
    ? (await (await crearClienteServidor()).auth.getUser()).data.user
    : null;
  return (
    <main className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-marca">Eat-em</h1>
        {usuario && (
          <form action="/salir" method="post" className="flex items-center gap-2 text-sm text-texto-suave">
            <span className="max-w-40 truncate">{usuario.email}</span>
            <button type="submit" className="rounded-lg border border-borde px-2 py-1">Salir</button>
          </form>
        )}
      </div>
      <p className="mt-1 text-texto-suave">Tu dieta, tu despensa y tu lista de la compra, sincronizadas.</p>

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Link href="/escanear" className="rounded-xl bg-marca px-4 py-4 text-center font-semibold text-marca-texto">Escanear compra</Link>
        <Link href="/inventario" className="rounded-xl border border-borde bg-superficie px-4 py-4 text-center font-semibold">Inventario</Link>
        <Link href="/lista" className="rounded-xl border border-borde bg-superficie px-4 py-3 text-center font-semibold">Lista</Link>
        <Link href="/grupo" className="rounded-xl border border-borde bg-superficie px-4 py-3 text-center font-semibold">Hogar</Link>
      </div>

      <p className="mt-6 text-sm font-medium text-texto-suave">Próximamente</p>
      <ul className="mt-2 space-y-2">
        {PANTALLAS.map((p) => (
          <li key={p.nombre} className="rounded-xl border border-borde bg-superficie px-4 py-3">
            <p className="font-semibold">{p.nombre}</p>
            <p className="text-sm text-texto-suave">{p.detalle}</p>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs text-texto-suave">
        Eat-em no sustituye a un profesional sanitario.
      </p>
    </main>
  );
}

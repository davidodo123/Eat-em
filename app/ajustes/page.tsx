import type { Metadata } from "next";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ActivarNotificaciones, Preferencias } from "./notificaciones";
import { SelectorTema } from "./tema";

export const metadata: Metadata = { title: "Ajustes · Eat-em" };

export default async function Ajustes() {
  const supabase = await crearClienteServidor();
  const { data: u } = await supabase.auth.getUser();
  const { data: prefs } = await supabase.from("notificacion_prefs").select("*").eq("usuario_id", u.user!.id).maybeSingle();
  const clave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  return (
    <main className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-10">
      <Link href="/" className="text-sm text-texto-suave">← Inicio</Link>
      <h1 className="mt-2 mb-4 text-2xl font-bold">Ajustes</h1>

      <section className="mb-4 space-y-3 rounded-xl border border-borde bg-superficie p-4">
        <h2 className="font-semibold">Notificaciones</h2>
        {clave ? <ActivarNotificaciones clavePublica={clave} /> : <p className="text-sm text-texto-suave">Las notificaciones aún no están configuradas en el servidor.</p>}
        <Preferencias v={{
          item_anadido: prefs?.item_anadido ?? true, stock_bajo: prefs?.stock_bajo ?? true,
          recordatorio_comidas: prefs?.recordatorio_comidas ?? false, recordatorio_compra: prefs?.recordatorio_compra ?? false,
        }} diaCompra={prefs?.dia_compra ?? null} />
      </section>

      <section className="mb-4 space-y-3 rounded-xl border border-borde bg-superficie p-4">
        <h2 className="font-semibold">Apariencia</h2>
        <SelectorTema />
      </section>

      <section className="space-y-2 rounded-xl border border-borde bg-superficie p-4 text-sm">
        <h2 className="font-semibold">Cuenta y privacidad</h2>
        <p><Link href="/perfil" className="text-marca underline">Perfil y datos de salud</Link> (puedes retirar el consentimiento y se borran).</p>
        <p className="text-texto-suave">Sesión: {u.user!.email}</p>
        <form action="/salir" method="post"><button className="rounded-xl border border-borde px-4 py-2 font-medium">Cerrar sesión</button></form>
      </section>
    </main>
  );
}

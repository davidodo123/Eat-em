// Portada: accesos a las pantallas y avisos de primer uso.
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { supabaseConfigurado } from "@/lib/env";
import { hogarActual } from "@/lib/grupo";

export default async function Inicio() {
  const supabase = supabaseConfigurado ? await crearClienteServidor() : null;
  const usuario = supabase ? (await supabase.auth.getUser()).data.user : null;
  const [hogar, salud] = supabase && usuario
    ? await Promise.all([
        hogarActual(supabase),
        supabase.from("perfiles_salud").select("consentimiento_salud_en").eq("usuario_id", usuario.id).maybeSingle().then((r) => r.data),
      ])
    : [null, null];

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

      {usuario && (!hogar || !salud?.consentimiento_salud_en) && (
        <ol className="mt-5 space-y-2 rounded-xl border border-marca/40 bg-superficie p-4 text-sm">
          <li className="font-semibold">Para empezar</li>
          <li className={hogar ? "text-texto-suave line-through" : ""}>
            1. {hogar ? "Hogar creado" : <Link href="/grupo" className="font-medium text-marca underline">Crea tu hogar o únete al de tu pareja</Link>}
          </li>
          <li className={salud?.consentimiento_salud_en ? "text-texto-suave line-through" : ""}>
            2. {salud?.consentimiento_salud_en ? "Perfil completado" : <Link href="/perfil" className="font-medium text-marca underline">Completa tu perfil para calcular tus objetivos</Link>}
          </li>
        </ol>
      )}

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Link href="/hoy" className="rounded-xl bg-marca px-4 py-4 text-center font-semibold text-marca-texto">Hoy</Link>
        <Link href="/dieta" className="rounded-xl border border-borde bg-superficie px-4 py-4 text-center font-semibold">Mi semana</Link>
        <Link href="/escanear" className="rounded-xl bg-marca px-4 py-4 text-center font-semibold text-marca-texto">Escanear compra</Link>
        <Link href="/inventario" className="rounded-xl border border-borde bg-superficie px-4 py-4 text-center font-semibold">Inventario</Link>
        <Link href="/lista" className="rounded-xl border border-borde bg-superficie px-4 py-3 text-center font-semibold">Lista</Link>
        <Link href="/grupo" className="rounded-xl border border-borde bg-superficie px-4 py-3 text-center font-semibold">Hogar</Link>
        <Link href="/comparar" className="rounded-xl border border-borde bg-superficie px-4 py-3 text-center font-semibold">Comparar precios</Link>
        <Link href="/perfil" className="rounded-xl border border-borde bg-superficie px-4 py-3 text-center font-semibold">Perfil</Link>
        <Link href="/nutriem" className="rounded-xl border border-borde bg-superficie px-4 py-3 text-center font-semibold">Nutri-em</Link>
        <Link href="/ajustes" className="rounded-xl border border-borde bg-superficie px-4 py-3 text-center font-semibold">Ajustes</Link>
      </div>

      <p className="mt-8 text-xs text-texto-suave">Eat-em no sustituye a un profesional sanitario.</p>
    </main>
  );
}

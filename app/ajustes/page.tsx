import type { Metadata } from "next";
import Link from "next/link";
import { crearClienteServidor, usuarioActual } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";
import { NOMBRE_CADENA, zonaDelHogar } from "@/lib/zona";
import { ActivarNotificaciones, Preferencias } from "./notificaciones";
import { SelectorTema } from "./tema";
import { Cabecera, Pantalla, Seccion, Tarjeta } from "../ui";

export const metadata: Metadata = { title: "Ajustes · Eat-em" };

function Fila({ href, icono, titulo, detalle }: { href: string; icono: string; titulo: string; detalle?: string | null }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 px-4 py-3 active:bg-borde/40">
        <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-marca/10 text-base">{icono}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{titulo}</span>
          {detalle && <span className="block truncate text-xs text-texto-suave">{detalle}</span>}
        </span>
        <span aria-hidden className="text-xl text-texto-suave/60">›</span>
      </Link>
    </li>
  );
}

export default async function Ajustes() {
  const supabase = await crearClienteServidor();
  const { data: u } = await usuarioActual();
  const [{ data: prefs }, hogar, { data: salud }] = await Promise.all([
    supabase.from("notificacion_prefs").select("*").eq("usuario_id", u.user!.id).maybeSingle(),
    hogarActual(supabase),
    supabase.from("perfiles_salud").select("consentimiento_salud_en").eq("usuario_id", u.user!.id).maybeSingle(),
  ]);
  const zona = hogar ? await zonaDelHogar(supabase, hogar.id) : null;
  const clave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

  return (
    <Pantalla>
      <Cabecera titulo="Ajustes" sub={u.user!.email} />

      <Seccion titulo="Tu casa">
        <Tarjeta><ul className="divide-y divide-borde">
          <Fila href="/ubicacion" icono="📍" titulo="Ubicación y supermercados"
            detalle={zona?.lugar ? `${zona.lugar} · ${zona.cadenasCerca.map((c) => NOMBRE_CADENA[c] ?? c).join(", ") || "sin cadenas cerca"}` : "Sin poner: usamos todos los supermercados"} />
          <Fila href="/grupo" icono="🏠" titulo="Hogar" detalle={hogar ? `${hogar.nombre} · código ${hogar.codigo_invitacion}` : "Crea uno o únete al de tu pareja"} />
          <Fila href="/escanear" icono="▦" titulo="Escanear un código de barras" detalle="Para guardar lo que compras con su precio" />
          <Fila href="/comparar" icono="€" titulo="Comparar precios" detalle="Por ingrediente, en tus supermercados" />
        </ul></Tarjeta>
      </Seccion>

      <Seccion titulo="Tú">
        <Tarjeta><ul className="divide-y divide-borde">
          <Fila href="/perfil" icono="👤" titulo="Perfil y salud" detalle={salud?.consentimiento_salud_en ? "Objetivos calculados" : "Complétalo para que la dieta se ajuste a ti"} />
          <Fila href="/nutriem" icono="💬" titulo="Nutri-em" detalle="Pregunta dudas de alimentación" />
        </ul></Tarjeta>
      </Seccion>

      <Seccion titulo="Notificaciones">
        <Tarjeta className="space-y-3 p-4">
          {clave ? <ActivarNotificaciones clavePublica={clave} /> : <p className="text-sm text-texto-suave">Las notificaciones aún no están configuradas en el servidor.</p>}
          <Preferencias v={{
            item_anadido: prefs?.item_anadido ?? true, stock_bajo: prefs?.stock_bajo ?? true,
            recordatorio_comidas: prefs?.recordatorio_comidas ?? false, recordatorio_compra: prefs?.recordatorio_compra ?? false,
          }} diaCompra={prefs?.dia_compra ?? null} />
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Apariencia">
        <Tarjeta className="p-4"><SelectorTema /></Tarjeta>
      </Seccion>

      <form action="/salir" method="post" className="mb-4">
        <button className="w-full rounded-2xl bg-superficie py-3.5 font-medium text-urgente shadow-[0_1px_0_var(--borde)]">Cerrar sesión</button>
      </form>
      <p className="px-1 text-xs text-texto-suave">Eat-em no sustituye a un profesional sanitario. Puedes retirar el consentimiento de tus datos de salud en Perfil y se borran.</p>
    </Pantalla>
  );
}

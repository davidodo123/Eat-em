import type { Metadata } from "next";
import Link from "next/link";
import { crearClienteServidor, usuarioActual } from "@/lib/supabase/server";
import { formatearCantidad } from "@/lib/dominio/cantidad";
import type { UnidadBase } from "@/lib/dominio/formato";
import { cuadriculaMes, diaSemana, esFecha, lunesDeLaSemana, mismoMes, numeroDia, semanaDe, sumarDias } from "@/lib/dominio/calendario";
import { BorrarComida, BotonGenerar, NuevaComida, RepetirSemana } from "./boton";
import { BotonesComida, NuevaExtra } from "../hoy/comida";
import { Cabecera, Pantalla, Seccion, Tarjeta, Vacio } from "../ui";

export const metadata: Metadata = { title: "Dieta · Eat-em" };
// Rellenar la semana con IA son 7 llamadas: las Server Actions de esta pagina necesitan tiempo
export const maxDuration = 300;

const TIPO: Record<string, string> = { desayuno: "Desayuno", media_manana: "Media mañana", comida: "Comida", merienda: "Merienda", cena: "Cena", extra: "Otro" };
const ORDEN_TIPO = Object.keys(TIPO);
const INICIAL = ["L", "M", "X", "J", "V", "S", "D"];
const fechaLarga = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-ES", { ...o, timeZone: "UTC" });

// Siguiente momento del dia segun la hora (para proponerlo al anadir)
function momentoAhora() {
  const h = Number(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/Madrid" }));
  return h < 11 ? "desayuno" : h < 13 ? "media_manana" : h < 17 ? "comida" : h < 20 ? "merienda" : "cena";
}

type Comida = { id: number; dieta_id: number; dia: string; tipo: string; orden: number; nombre: string; preparacion: string | null; dieta_comida_ingredientes: { ingrediente_id: string; cantidad: number }[] };

export default async function Dieta({ searchParams }: { searchParams: Promise<{ d?: string; v?: string }> }) {
  const sp = await searchParams;
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" });
  const dia = sp.d && esFecha(sp.d) ? sp.d : hoy;
  const vista = sp.v === "mes" ? "mes" : "semana";
  const semana = semanaDe(dia);
  const rejilla = vista === "mes" ? cuadriculaMes(dia) : semana;

  const supabase = await crearClienteServidor();
  const { data: u } = await usuarioActual();
  const { data: dietas } = await supabase.from("dietas").select("id, semana_inicio, objetivos")
    .eq("usuario_id", u.user!.id).eq("estado", "activa").gte("semana_inicio", rejilla[0]).lte("semana_inicio", rejilla.at(-1)!);
  const ids = (dietas ?? []).map((d) => d.id);
  const [{ data: comidas }, { data: ings }, { data: consumos }] = await Promise.all([
    ids.length ? supabase.from("dieta_comidas").select("id, dieta_id, dia, tipo, orden, nombre, preparacion, dieta_comida_ingredientes (ingrediente_id, cantidad)").in("dieta_id", ids)
      : Promise.resolve({ data: [] as Comida[] }),
    supabase.from("ingredientes").select("id, nombre, unidad").eq("activo", true).order("nombre"),
    dia === hoy ? supabase.from("consumos").select("id, dieta_comida_id, estado, nombre, tipo").eq("usuario_id", u.user!.id).eq("fecha", hoy) : Promise.resolve({ data: [] }),
  ]);
  const ing = new Map((ings ?? []).map((i) => [i.id, i]));
  const semanaDeDieta = new Map((dietas ?? []).map((d) => [d.id, d.semana_inicio as string]));

  // Comidas por fecha
  const porFecha = new Map<string, Comida[]>();
  for (const c of (comidas ?? []) as Comida[]) {
    const lunes = semanaDeDieta.get(c.dieta_id)!;
    const f = semanaDe(lunes).find((x) => diaSemana(x) === c.dia)!;
    porFecha.set(f, [...(porFecha.get(f) ?? []), c]);
  }
  for (const l of porFecha.values()) l.sort((a, b) => ORDEN_TIPO.indexOf(a.tipo) - ORDEN_TIPO.indexOf(b.tipo) || a.orden - b.orden);

  const delDia = porFecha.get(dia) ?? [];
  const consumo = new Map((consumos ?? []).filter((c) => c.dieta_comida_id).map((c) => [c.dieta_comida_id as number, c]));
  const objetivos = (dietas ?? []).find((d) => d.semana_inicio === lunesDeLaSemana(dia))?.objetivos as { kcal: number; proteina_g: number } | null;
  const lunes = lunesDeLaSemana(dia);
  const enlace = (d: string, v = vista) => `/dieta?d=${d}${v === "mes" ? "&v=mes" : ""}`;
  const anterior = vista === "mes" ? `${sumarDias(`${dia.slice(0, 7)}-01`, -1).slice(0, 7)}-01` : sumarDias(dia, -7);
  const siguiente = vista === "mes" ? `${sumarDias(`${dia.slice(0, 7)}-01`, 32).slice(0, 7)}-01` : sumarDias(dia, 7);
  const titulo = vista === "mes" ? fechaLarga(dia, { month: "long", year: "numeric" })
    : `${fechaLarga(semana[0], { day: "numeric", month: "short" })} – ${fechaLarga(semana[6], { day: "numeric", month: "short" })}`;

  return (
    <Pantalla>
      <Cabecera titulo="Dieta"
        sub={objetivos ? `Objetivo: ${objetivos.kcal.toLocaleString("es-ES")} kcal · ${objetivos.proteina_g} g de proteína al día` : <Link href="/perfil" className="text-marca">Completa tu perfil para calcular tus objetivos</Link>}
        accion={
          <nav aria-label="Vista" className="grid grid-cols-2 rounded-xl bg-borde/60 p-0.5 text-sm font-medium">
            {(["semana", "mes"] as const).map((v) => (
              <Link key={v} href={enlace(dia, v)} aria-current={vista === v ? "page" : undefined}
                className={`rounded-[10px] px-3 py-1.5 text-center ${vista === v ? "bg-superficie shadow-sm" : "text-texto-suave"}`}>{v === "semana" ? "Semana" : "Mes"}</Link>
            ))}
          </nav>
        } />

      {/* Calendario */}
      <Tarjeta className="mb-5 p-3">
        <div className="mb-2 flex items-center justify-between">
          <Link href={enlace(anterior)} aria-label="Anterior" className="grid h-9 w-9 place-items-center rounded-full text-xl text-marca active:bg-borde/50">‹</Link>
          <span className="font-semibold first-letter:uppercase">{titulo}</span>
          <Link href={enlace(siguiente)} aria-label="Siguiente" className="grid h-9 w-9 place-items-center rounded-full text-xl text-marca active:bg-borde/50">›</Link>
        </div>
        <div className="grid grid-cols-7 gap-y-1 text-center">
          {INICIAL.map((l, i) => <span key={i} className="text-[0.7rem] font-semibold text-texto-suave">{l}</span>)}
          {rejilla.map((f) => {
            const n = porFecha.get(f)?.length ?? 0;
            const elegido = f === dia, esHoy = f === hoy, fuera = vista === "mes" && !mismoMes(f, dia);
            return (
              <Link key={f} href={enlace(f, "semana")} aria-label={fechaLarga(f, { weekday: "long", day: "numeric", month: "long" })}
                aria-current={elegido ? "date" : undefined}
                className={`mx-auto flex w-10 flex-col items-center rounded-xl ${vista === "mes" ? "py-1" : "py-1.5"} ${elegido ? "bg-marca text-marca-texto" : esHoy ? "text-marca" : fuera ? "text-texto-suave/50" : ""}`}>
                <span className={`text-[0.95rem] tabular-nums ${esHoy || elegido ? "font-bold" : ""}`}>{numeroDia(f)}</span>
                <span className="flex h-1.5 gap-0.5">
                  {Array.from({ length: Math.min(n, 4) }, (_, k) => <span key={k} className={`h-1 w-1 rounded-full ${elegido ? "bg-marca-texto" : "bg-marca"}`} />)}
                </span>
              </Link>
            );
          })}
        </div>
      </Tarjeta>

      {/* Dia elegido */}
      <Seccion titulo={dia === hoy ? "Hoy" : fechaLarga(dia, { weekday: "long", day: "numeric", month: "long" })}
        extra={dia !== hoy ? <Link href={enlace(hoy)} className="text-sm font-medium text-marca">Ir a hoy</Link> : undefined}>
        {!delDia.length && <Vacio icono="🍽️" titulo="Nada planificado" texto="Añade tus comidas a mano o deja que la IA rellene la semana." />}
        <ul className="space-y-2.5">
          {delDia.map((c) => {
            const k = consumo.get(c.id);
            const lista = c.dieta_comida_ingredientes.map((x) => {
              const i = ing.get(x.ingrediente_id);
              return { id: x.ingrediente_id, nombre: i?.nombre ?? x.ingrediente_id, cantidad: Number(x.cantidad), unidad: i?.unidad ?? "g" };
            });
            return (
              <li key={c.id}>
                <Tarjeta className={`p-4 ${k?.estado === "hecha" ? "ring-2 ring-marca/40" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[0.7rem] font-bold uppercase tracking-wider text-marca">{TIPO[c.tipo] ?? c.tipo}</p>
                      <p className="font-semibold leading-snug">{c.nombre}</p>
                    </div>
                    {!k && <BorrarComida id={c.id} nombre={c.nombre} />}
                  </div>
                  {lista.length > 0 && (
                    <p className="mt-1 text-sm text-texto-suave">
                      {lista.map((x) => `${x.nombre.toLowerCase()} ${formatearCantidad(x.cantidad, x.unidad as UnidadBase)}`).join(" · ")}
                    </p>
                  )}
                  {c.preparacion && (
                    <details className="mt-1 text-sm">
                      <summary className="cursor-pointer text-texto-suave">Preparación</summary>
                      <p className="mt-1">{c.preparacion}</p>
                    </details>
                  )}
                  {dia === hoy && <div className="mt-3"><BotonesComida comidaId={c.id} consumo={k ? { id: k.id, estado: k.estado } : null} ingredientes={lista} /></div>}
                </Tarjeta>
              </li>
            );
          })}
        </ul>
        <div className="mt-3"><NuevaComida key={dia} fecha={dia} tipoInicial={dia === hoy ? momentoAhora() : "comida"} ingredientes={(ings ?? []).map((i) => ({ id: i.id, nombre: i.nombre, unidad: i.unidad }))} /></div>
        {dia === hoy && <div className="mt-3"><NuevaExtra ingredientes={(ings ?? []).map((i) => ({ id: i.id, nombre: i.nombre, unidad: i.unidad }))} /></div>}
      </Seccion>

      {lunes >= lunesDeLaSemana(hoy) && (
        <Seccion titulo="Esta semana">
          <Tarjeta className="divide-y divide-borde overflow-hidden">
            <BotonGenerar semana={lunes} hayPlan={semana.some((f) => porFecha.has(f))} iaLista={Boolean(process.env.OPENAI_API_KEY)} />
            {semana.some((f) => porFecha.has(f)) && <RepetirSemana semana={lunes} />}
          </Tarjeta>
        </Seccion>
      )}
      <p className="px-1 text-xs text-texto-suave">Plan orientativo. Eat-em no sustituye a un profesional sanitario.</p>
    </Pantalla>
  );
}

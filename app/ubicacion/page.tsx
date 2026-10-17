import type { Metadata } from "next";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";
import { CON_CATALOGO, NOMBRE_CADENA, zonaDelHogar } from "@/lib/zona";
import { Cabecera, Pantalla, Seccion, SinHogar, Tarjeta } from "../ui";
import { FormularioUbicacion } from "./formulario";

export const metadata: Metadata = { title: "Ubicación · Eat-em" };

export default async function Ubicacion() {
  const supabase = await crearClienteServidor();
  const hogar = await hogarActual(supabase);
  if (!hogar) return <Pantalla><Cabecera titulo="Ubicación" volver={{ href: "/ajustes", texto: "Ajustes" }} /><SinHogar que="La ubicación" /></Pantalla>;
  const zona = await zonaDelHogar(supabase, hogar.id);

  return (
    <Pantalla>
      <Cabecera titulo="Ubicación" volver={{ href: "/ajustes", texto: "Ajustes" }}
        sub="Buscamos los supermercados que tienes cerca para darte sus productos y precios." />

      <Tarjeta className="mb-5 p-4"><FormularioUbicacion radio={zona.radioKm} /></Tarjeta>

      {zona.lugar && (
        <Seccion titulo={`Cerca de ${zona.lugar} · ${zona.radioKm} km`}>
          <Tarjeta className="p-4">
            <div className="flex flex-wrap gap-2">
              {zona.cadenasCerca.length ? zona.cadenasCerca.map((c) => (
                <span key={c} className={`rounded-full px-3 py-1 text-sm font-medium ${CON_CATALOGO.includes(c) ? "bg-marca/15 text-marca" : "bg-borde/60 text-texto-suave"}`}>
                  {NOMBRE_CADENA[c] ?? c}{CON_CATALOGO.includes(c) ? "" : " · sin datos"}
                </span>
              )) : <p className="text-sm text-texto-suave">No hemos encontrado cadenas conocidas en esa distancia. Prueba con más kilómetros.</p>}
            </div>
            {!zona.buscarEn && zona.cadenasCerca.length > 0 && (
              <p className="mt-3 text-sm text-texto-suave">Aún no tenemos el catálogo de estas cadenas: te enseñamos el de todas las que sí tenemos.</p>
            )}
          </Tarjeta>
        </Seccion>
      )}

      {zona.tiendas.length > 0 && (
        <Seccion titulo="Tiendas más cercanas">
          <Tarjeta>
            <ul className="divide-y divide-borde">
              {zona.tiendas.slice(0, 12).map((t, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="truncate">{t.nombre}</span>
                  <span className="shrink-0 text-sm tabular-nums text-texto-suave">{t.km.toLocaleString("es-ES")} km</span>
                </li>
              ))}
            </ul>
          </Tarjeta>
        </Seccion>
      )}
      <p className="px-1 text-xs text-texto-suave">Mapas: © colaboradores de OpenStreetMap (ODbL). La ubicación se guarda redondeada (~1 km) y solo la ve tu hogar.</p>
    </Pantalla>
  );
}

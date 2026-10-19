import type { Metadata } from "next";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hogarActual } from "@/lib/grupo";
import { DiasLista, FormulariosHogar } from "./formularios";
import { Cabecera, Pantalla } from "../ui";

export const metadata: Metadata = { title: "Hogar · Eat-em" };

export default async function Grupo() {
  const supabase = await crearClienteServidor();
  const hogar = await hogarActual(supabase);
  const miembros = hogar
    ? (await supabase.from("grupo_miembros").select("rol, usuario_id").eq("grupo_id", hogar.id).order("unido_en")).data ?? []
    : [];
  const nombres = new Map(
    miembros.length
      ? ((await supabase.from("perfiles").select("id, nombre").in("id", miembros.map((m) => m.usuario_id))).data ?? [])
          .map((p) => [p.id, p.nombre])
      : [],
  );

  return (
    <Pantalla>
      <Cabecera titulo="Hogar" volver={{ href: "/ajustes", texto: "Ajustes" }} />
      {!hogar ? (
        <>
          <p className="mb-4 text-texto-suave">El inventario y la lista de la compra se comparten con tu hogar. Crea uno o únete con el código que te pasen.</p>
          <FormulariosHogar />
        </>
      ) : (
        <div className="space-y-4">
          <div className="caja p-4">
            <p className="text-lg font-semibold">{hogar.nombre}</p>
            <p className="mt-3 text-sm text-texto-suave">Código para invitar</p>
            <p className="font-mono text-2xl tracking-widest select-all">{hogar.codigo_invitacion}</p>
          </div>
          <div className="caja p-4">
            <DiasLista dias={(await supabase.from("grupos").select("dias_planificacion").eq("id", hogar.id).single()).data?.dias_planificacion ?? 7} />
          </div>
          <div className="caja p-4">
            <p className="mb-2 font-semibold">Miembros</p>
            <ul className="space-y-1 text-sm">
              {miembros.map((m) => (
                <li key={m.usuario_id} className="flex justify-between">
                  <span>{nombres.get(m.usuario_id) || "Sin nombre"}</span>
                  <span className="text-texto-suave">{m.rol}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Pantalla>
  );
}

"use client";
import { useMemo, useState, useTransition } from "react";
import { Camara } from "./camara";
import { altaManual, buscarCodigo, registrarCompra, type ResultadoBusqueda, type ResultadoGuardar } from "./acciones";
import { cantidadComprada } from "@/lib/dominio/inventario";
import type { UnidadBase } from "@/lib/dominio/formato";

export interface IngredienteOpcion { id: string; nombre: string; unidad: UnidadBase; gramos_por_unidad: number | null }
export interface SuperOpcion { id: string; nombre: string }

const campo = "mt-1 block w-full rounded-xl border border-borde bg-superficie px-3 py-2.5 text-base outline-none focus:border-marca";
const botonPrincipal = "w-full rounded-xl bg-marca px-4 py-3 font-semibold text-marca-texto disabled:opacity-60";
const botonSecundario = "w-full rounded-xl border border-borde px-4 py-3 font-medium";
const UNIDAD: Record<UnidadBase, string> = { g: "g", ml: "ml", unidad: "uds" };

export function Escaner({ ingredientes, supermercados, superPorDefecto }: {
  ingredientes: IngredienteOpcion[]; supermercados: SuperOpcion[]; superPorDefecto: string;
}) {
  const [camara, setCamara] = useState(true);
  const [manual, setManual] = useState("");
  const [resultado, setResultado] = useState<ResultadoBusqueda | null>(null);
  const [guardado, setGuardado] = useState<ResultadoGuardar | null>(null);
  const [pendiente, empezar] = useTransition();

  const buscar = (codigo: string) => {
    setCamara(false);
    setGuardado(null);
    empezar(async () => setResultado(await buscarCodigo(codigo)));
  };
  const reiniciar = () => { setResultado(null); setGuardado(null); setManual(""); setCamara(true); };

  return (
    <div className="space-y-4">
      {!resultado && (
        <>
          {camara && <Camara onCodigo={buscar} />}
          <form onSubmit={(e) => { e.preventDefault(); buscar(manual); }} className="flex gap-2">
            <input
              value={manual} onChange={(e) => setManual(e.target.value)} inputMode="numeric" pattern="[0-9 ]*"
              placeholder="O escribe el código" aria-label="Código de barras" className={`${campo} mt-0 flex-1 font-mono`}
            />
            <button type="submit" disabled={pendiente || manual.replace(/\D/g, "").length < 8}
              className="rounded-xl bg-marca px-4 font-semibold text-marca-texto disabled:opacity-60">Buscar</button>
          </form>
        </>
      )}

      {pendiente && <p className="text-center text-texto-suave" role="status">Buscando…</p>}

      {!pendiente && resultado?.estado === "error" && (
        <div className="space-y-3">
          <p className="rounded-xl border border-urgente/40 p-4 text-sm text-urgente" role="alert">{resultado.mensaje}</p>
          <button onClick={reiniciar} className={botonSecundario}>Escanear otro</button>
        </div>
      )}

      {!pendiente && resultado?.estado === "desconocido" && (
        <AltaManual ean={resultado.ean} onResultado={setResultado} onCancelar={reiniciar} />
      )}

      {!pendiente && resultado?.estado === "encontrado" && (
        guardado?.ok ? (
          <div className="space-y-3">
            <p className="rounded-xl border border-marca/40 bg-superficie p-4 font-medium text-marca" role="status">✓ {guardado.mensaje}</p>
            <button onClick={reiniciar} className={botonPrincipal}>Escanear otro</button>
          </div>
        ) : (
          <FormularioCompra
            resultado={resultado} ingredientes={ingredientes} supermercados={supermercados}
            superPorDefecto={superPorDefecto} error={guardado && !guardado.ok ? guardado.mensaje : null}
            onGuardado={setGuardado} onCancelar={reiniciar}
          />
        )
      )}
    </div>
  );
}

function FormularioCompra({ resultado, ingredientes, supermercados, superPorDefecto, error, onGuardado, onCancelar }: {
  resultado: Extract<ResultadoBusqueda, { estado: "encontrado" }>;
  ingredientes: IngredienteOpcion[]; supermercados: SuperOpcion[]; superPorDefecto: string;
  error: string | null; onGuardado: (r: ResultadoGuardar) => void; onCancelar: () => void;
}) {
  // La ficha de la tienda elegida si existe; si no, la primera (con imagen si la hay)
  const [supermercado, setSupermercado] = useState(superPorDefecto);
  const producto = useMemo(
    () => resultado.productos.find((p) => p.supermercado_id === supermercado)
      ?? [...resultado.productos].sort((a, b) => Number(!!b.imagen_url) - Number(!!a.imagen_url))[0],
    [resultado, supermercado],
  );
  const [ingredienteId, setIngredienteId] = useState(resultado.candidatos[0]?.ingrediente_id ?? "");
  const [unidades, setUnidades] = useState(1);
  const ingrediente = ingredientes.find((i) => i.id === ingredienteId);
  const sugerida = ingrediente ? cantidadComprada(producto, ingrediente, unidades) : null;
  const [cantidadEditada, setCantidadEditada] = useState<string | null>(null);
  const precioTienda = resultado.productos.find((p) => p.supermercado_id === supermercado)?.precio ?? null;
  const [guardando, empezar] = useTransition();

  const candidatos = new Set(resultado.candidatos.map((c) => c.ingrediente_id));
  const ordenados = [...ingredientes].sort((a, b) => Number(candidatos.has(b.id)) - Number(candidatos.has(a.id)) || a.nombre.localeCompare(b.nombre));

  return (
    <form
      className="space-y-4"
      action={(datos) => empezar(async () => onGuardado(await registrarCompra(datos)))}
    >
      <div className="flex gap-3 rounded-xl border border-borde bg-superficie p-3">
        {producto.imagen_url && (
          // eslint-disable-next-line @next/next/no-img-element -- imagenes de muchas tiendas distintas
          <img src={producto.imagen_url} alt="" className="h-20 w-20 shrink-0 rounded-lg bg-white object-contain" />
        )}
        <div className="min-w-0">
          <p className="font-semibold leading-tight">{producto.nombre}</p>
          <p className="text-sm text-texto-suave">
            {[producto.marca, producto.cantidad_neta && producto.unidad ? `${producto.cantidad_neta} ${UNIDAD[producto.unidad]}` : null].filter(Boolean).join(" · ")}
          </p>
          {producto.alergenos.length > 0 && <p className="mt-1 text-xs text-aviso">Alérgenos: {producto.alergenos.join(", ").replace(/_/g, " ")}</p>}
          <p className="mt-1 font-mono text-xs text-texto-suave">{resultado.ean}</p>
        </div>
      </div>

      <input type="hidden" name="ean" value={resultado.ean} />
      <input type="hidden" name="producto_id" value={producto.id} />

      <label className="block">
        <span className="text-sm font-medium">¿Qué es para tu despensa?</span>
        <select name="ingrediente_id" required value={ingredienteId} onChange={(e) => { setIngredienteId(e.target.value); setCantidadEditada(null); }} className={campo}>
          <option value="" disabled>Elige un ingrediente</option>
          {ordenados.map((i) => <option key={i.id} value={i.id}>{candidatos.has(i.id) ? "★ " : ""}{i.nombre}</option>)}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium">Envases</span>
          <input type="number" min={1} max={99} value={unidades} onChange={(e) => { setUnidades(Math.max(1, Number(e.target.value) || 1)); setCantidadEditada(null); }} className={campo} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Cantidad{ingrediente ? ` (${UNIDAD[ingrediente.unidad]})` : ""}</span>
          <input name="cantidad" inputMode="decimal" required value={cantidadEditada ?? (sugerida ? String(sugerida) : "")}
            onChange={(e) => setCantidadEditada(e.target.value)} className={campo} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium">Tienda</span>
          <select name="supermercado" value={supermercado} onChange={(e) => setSupermercado(e.target.value)} className={campo}>
            {supermercados.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Precio (€)</span>
          <input name="precio" inputMode="decimal" placeholder={precioTienda ? String(precioTienda) : "Opcional"} className={campo} />
        </label>
      </div>
      {resultado.ultimoPrecio && (
        <p className="text-xs text-texto-suave">Último precio apuntado: {resultado.ultimoPrecio.precio.toFixed(2)} € en {supermercados.find((s) => s.id === resultado.ultimoPrecio!.supermercado)?.nombre ?? resultado.ultimoPrecio.supermercado}</p>
      )}

      {error && <p className="text-sm text-urgente" role="alert">{error}</p>}
      <button type="submit" disabled={guardando} className={botonPrincipal}>{guardando ? "Guardando…" : "Añadir al inventario"}</button>
      <button type="button" onClick={onCancelar} className={botonSecundario}>Cancelar</button>
    </form>
  );
}

function AltaManual({ ean, onResultado, onCancelar }: {
  ean: string; onResultado: (r: ResultadoBusqueda) => void; onCancelar: () => void;
}) {
  const [guardando, empezar] = useTransition();
  return (
    <form className="space-y-3" action={(datos) => empezar(async () => onResultado(await altaManual(datos)))}>
      <p className="rounded-xl border border-borde bg-superficie p-4 text-sm">
        No conocemos el código <span className="font-mono">{ean}</span>. Dalo de alta y quedará pendiente de revisión.
      </p>
      <input type="hidden" name="ean" value={ean} />
      <label className="block"><span className="text-sm font-medium">Nombre</span>
        <input name="nombre" required minLength={3} maxLength={300} placeholder="Leche semidesnatada" className={campo} /></label>
      <label className="block"><span className="text-sm font-medium">Marca</span>
        <input name="marca" maxLength={120} placeholder="Hacendado" className={campo} /></label>
      <label className="block"><span className="text-sm font-medium">Formato</span>
        <input name="formato" maxLength={60} placeholder="1 l, 6 x 125 g…" className={campo} /></label>
      <button type="submit" disabled={guardando} className={botonPrincipal}>{guardando ? "Guardando…" : "Dar de alta"}</button>
      <button type="button" onClick={onCancelar} className={botonSecundario}>Cancelar</button>
    </form>
  );
}

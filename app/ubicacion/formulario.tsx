"use client";
import { startTransition, useActionState, useRef, useState } from "react";
import { guardarUbicacion, type EstadoUbicacion } from "./acciones";
import { boton, botonSuave, campo } from "../ui";

export function FormularioUbicacion({ radio }: { radio: number }) {
  const [estado, accion, enviando] = useActionState<EstadoUbicacion, FormData>(guardarUbicacion, {});
  const form = useRef<HTMLFormElement>(null);
  const [gps, setGps] = useState<{ lat: string; lon: string } | null>(null);
  const [errorGps, setErrorGps] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  const usarGps = () => {
    if (!navigator.geolocation) return setErrorGps("Tu navegador no permite la ubicación: usa el código postal.");
    setBuscando(true); setErrorGps(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const punto = { lat: p.coords.latitude.toFixed(4), lon: p.coords.longitude.toFixed(4) };
        setGps(punto);
        setBuscando(false);
        const datos = new FormData(form.current!);
        datos.set("lat", punto.lat); datos.set("lon", punto.lon); datos.set("cp", "");
        startTransition(() => accion(datos));
      },
      () => { setBuscando(false); setErrorGps("No hay permiso de ubicación. Escribe tu código postal."); },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 600_000 },
    );
  };

  return (
    <form ref={form} action={accion} className="space-y-4">
      <input type="hidden" name="lat" value={gps?.lat ?? ""} />
      <input type="hidden" name="lon" value={gps?.lon ?? ""} />
      <button type="button" onClick={usarGps} disabled={buscando || enviando} className={`${boton} flex w-full items-center justify-center gap-2`}>
        <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" /></svg>
        {buscando ? "Buscando tu ubicación…" : enviando && gps ? "Buscando supermercados…" : "Usar mi ubicación"}
      </button>
      {errorGps && <p className="text-sm text-urgente" role="alert">{errorGps}</p>}

      <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-texto-suave"><span className="h-px flex-1 bg-borde" />o<span className="h-px flex-1 bg-borde" /></div>

      <div className="flex gap-2">
        <label className="sr-only" htmlFor="cp">Código postal</label>
        <input id="cp" name="cp" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} placeholder="Código postal" autoComplete="postal-code"
          onChange={() => setGps(null)} className={`${campo} flex-1`} />
        <button type="submit" disabled={enviando} className={botonSuave}>{enviando && !gps ? "…" : "Buscar"}</button>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Distancia a la que vas a comprar</legend>
        <div className="grid grid-cols-4 gap-2">
          {[2, 5, 10, 20].map((r) => (
            <label key={r} className="cursor-pointer">
              <input type="radio" name="radio" value={r} defaultChecked={r === radio} className="peer sr-only" />
              <span className="block rounded-xl border border-borde bg-superficie py-2.5 text-center text-sm font-medium peer-checked:border-marca peer-checked:bg-marca peer-checked:text-marca-texto">{r} km</span>
            </label>
          ))}
        </div>
      </fieldset>
      {estado.error && <p className="text-sm text-urgente" role="alert">{estado.error}</p>}
      {estado.ok && <p className="text-sm font-medium text-marca" role="status">✓ Ubicación guardada</p>}
    </form>
  );
}

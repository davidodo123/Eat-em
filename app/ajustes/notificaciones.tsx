"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { avisoDePrueba, guardarPreferencias, guardarSuscripcion, quitarSuscripcion, type EstadoPrefs } from "./acciones";

function claveServidor(base64: string) {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const bin = atob((base64 + relleno).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function ActivarNotificaciones({ clavePublica }: { clavePublica: string }) {
  const [soporte, setSoporte] = useState<"si" | "no" | "ios" | null>(null);
  const [sub, setSub] = useState<PushSubscription | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      // En iPhone, Web Push solo funciona con la app anadida a la pantalla de inicio
      setSoporte(/iphone|ipad/i.test(navigator.userAgent) ? "ios" : "no");
      return;
    }
    setSoporte("si");
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((r) => r.pushManager.getSubscription()).then(setSub).catch(() => setSoporte("no"));
  }, []);

  const activar = () => empezar(async () => {
    setMensaje(null);
    if ((await Notification.requestPermission()) !== "granted") { setMensaje("Has bloqueado los avisos. Actívalos en los ajustes del navegador."); return; }
    const reg = await navigator.serviceWorker.ready;
    const nueva = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveServidor(clavePublica) });
    const r = await guardarSuscripcion(JSON.parse(JSON.stringify(nueva)));
    if (r.error) { await nueva.unsubscribe(); setMensaje(r.error); } else setSub(nueva);
  });
  const desactivar = () => empezar(async () => {
    if (!sub) return;
    await quitarSuscripcion(sub.endpoint);
    await sub.unsubscribe();
    setSub(null);
  });

  if (soporte === null) return null;
  if (soporte === "ios") return <p className="text-sm text-texto-suave">En iPhone, añade Eat-em a la pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrela desde ahí para activar los avisos.</p>;
  if (soporte === "no") return <p className="text-sm text-texto-suave">Este navegador no admite notificaciones.</p>;
  return (
    <div className="space-y-2">
      {sub ? (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={pendiente} onClick={() => empezar(async () => {
            const r = await avisoDePrueba(); setMensaje(r.enviadas ? "Aviso de prueba enviado." : "No se envió: activa «Cosas nuevas en la lista».");
          })} className="rounded-xl border border-borde px-3 py-2.5 font-medium">Enviar prueba</button>
          <button type="button" disabled={pendiente} onClick={desactivar} className="rounded-xl border border-borde px-3 py-2.5 font-medium">Desactivar aquí</button>
        </div>
      ) : (
        <button type="button" disabled={pendiente} onClick={activar}
          className="w-full rounded-xl bg-marca px-4 py-3 font-semibold text-marca-texto disabled:opacity-60">Activar avisos en este dispositivo</button>
      )}
      {mensaje && <p className="text-sm text-texto-suave" role="status">{mensaje}</p>}
    </div>
  );
}

export function Preferencias({ v, diaCompra }: { v: Record<string, boolean>; diaCompra: string | null }) {
  const [estado, accion, guardando] = useActionState<EstadoPrefs, FormData>(guardarPreferencias, {});
  const opciones: [string, string][] = [
    ["item_anadido", "Cosas nuevas en la lista de la compra"],
    ["stock_bajo", "Despensa: queda poco o algo caduca pronto"],
    ["recordatorio_comidas", "Recordatorio de comidas"],
    ["recordatorio_compra", "Recordatorio del día de la compra"],
  ];
  return (
    <form action={accion} className="space-y-2">
      {opciones.map(([k, t]) => (
        <label key={k} className="opcion">
          <input type="checkbox" name={k} defaultChecked={v[k]} /> {t}
        </label>
      ))}
      <label className="flex items-center justify-between gap-3 pt-1 text-sm font-medium">
        Día de la compra
        <select name="dia_compra" defaultValue={diaCompra ?? ""} className="w-40 px-3 py-2.5 text-base">
          <option value="">Ninguno</option>
          {[["lunes", "Lunes"], ["martes", "Martes"], ["miercoles", "Miércoles"], ["jueves", "Jueves"], ["viernes", "Viernes"], ["sabado", "Sábado"], ["domingo", "Domingo"]]
            .map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
      </label>
      <p className="text-xs text-texto-suave">Los recordatorios llegan por la mañana.</p>
      <button type="submit" disabled={guardando} className="mt-1 rounded-xl border border-borde px-4 py-2.5 font-semibold">
        {guardando ? "Guardando…" : "Guardar"}
      </button>
      {estado.ok && <span className="ml-3 text-sm font-semibold text-marca">Guardado</span>}
      {estado.error && <p className="text-sm text-urgente" role="alert">{estado.error}</p>}
    </form>
  );
}

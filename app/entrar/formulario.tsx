"use client";
import { useActionState, useState } from "react";
import { crearCuenta, entrar, type EstadoAcceso } from "./acciones";

const campo = "block w-full px-4 py-3.5 text-base";
const principal = "w-full rounded-xl bg-marca px-4 py-3.5 font-semibold text-marca-texto active:opacity-85 disabled:opacity-60";

// Entrar o crear cuenta con email y contrasena
export function FormularioEntrar({ siguiente }: { siguiente: string }) {
  const [modo, setModo] = useState<"entrar" | "crear">("entrar");
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-borde bg-superficie p-1" role="tablist">
        {([["entrar", "Entrar"], ["crear", "Crear cuenta"]] as const).map(([k, t]) => (
          <button key={k} type="button" role="tab" aria-selected={modo === k} onClick={() => setModo(k)}
            className={`rounded-lg py-2 text-sm font-semibold ${modo === k ? "bg-texto text-fondo" : "text-texto-suave"}`}>{t}</button>
        ))}
      </div>
      {modo === "entrar" ? <Entrar siguiente={siguiente} /> : <Crear />}
    </div>
  );
}

function Entrar({ siguiente }: { siguiente: string }) {
  const [estado, accion, enviando] = useActionState<EstadoAcceso, FormData>(entrar, {});
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="siguiente" value={siguiente} />
      <label className="sr-only" htmlFor="email">Email</label>
      <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" defaultValue={estado.email} placeholder="tu@email.com" className={campo} />
      <label className="sr-only" htmlFor="contrasena">Contraseña</label>
      <input id="contrasena" name="contrasena" type="password" required autoComplete="current-password" placeholder="Contraseña" className={campo} />
      <button type="submit" disabled={enviando} className={principal}>{enviando ? "Entrando…" : "Entrar"}</button>
      {estado.error && <p className="text-sm text-urgente" role="alert">{estado.error}</p>}
    </form>
  );
}

function Crear() {
  const [estado, accion, enviando] = useActionState<EstadoAcceso, FormData>(crearCuenta, {});
  return (
    <form action={accion} className="space-y-3">
      <label className="sr-only" htmlFor="nombre">Tu nombre</label>
      <input id="nombre" name="nombre" required autoComplete="given-name" maxLength={60} placeholder="Tu nombre" className={campo} />
      <label className="sr-only" htmlFor="email-nuevo">Email</label>
      <input id="email-nuevo" name="email" type="email" required autoComplete="email" inputMode="email" defaultValue={estado.email} placeholder="tu@email.com" className={campo} />
      <label className="sr-only" htmlFor="contrasena-nueva">Contraseña</label>
      <input id="contrasena-nueva" name="contrasena" type="password" required minLength={8} autoComplete="new-password" placeholder="Contraseña (mínimo 8 caracteres)" className={campo} />
      <button type="submit" disabled={enviando} className={principal}>{enviando ? "Creando…" : "Crear cuenta"}</button>
      {estado.error && <p className="text-sm text-urgente" role="alert">{estado.error}</p>}
    </form>
  );
}

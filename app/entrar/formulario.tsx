"use client";
import { useActionState, useState } from "react";
import { crearCuenta, entrarConContrasena, enviarEnlace, type EstadoAcceso, type EstadoEntrar } from "./acciones";

const campo = "block w-full px-4 py-3.5 text-base";
const principal = "w-full rounded-xl bg-marca px-4 py-3.5 font-semibold text-marca-texto active:opacity-85 disabled:opacity-60";

// Entrar o crear cuenta con email y contrasena (la cuenta nueva se confirma por correo).
// El enlace al correo queda como alternativa para quien no tiene contrasena.
export function FormularioEntrar({ siguiente }: { siguiente: string }) {
  const [modo, setModo] = useState<"entrar" | "crear" | "enlace">("entrar");
  return (
    <div>
      {modo !== "enlace" && (
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-borde bg-superficie p-1" role="tablist">
          {([["entrar", "Entrar"], ["crear", "Crear cuenta"]] as const).map(([k, t]) => (
            <button key={k} type="button" role="tab" aria-selected={modo === k} onClick={() => setModo(k)}
              className={`rounded-lg py-2 text-sm font-semibold ${modo === k ? "bg-texto text-fondo" : "text-texto-suave"}`}>{t}</button>
          ))}
        </div>
      )}
      {modo === "entrar" && <Entrar siguiente={siguiente} />}
      {modo === "crear" && <Crear siguiente={siguiente} />}
      {modo === "enlace" && <Enlace siguiente={siguiente} />}
      <button type="button" onClick={() => setModo(modo === "enlace" ? "entrar" : "enlace")}
        className="mt-4 w-full text-center text-sm font-medium text-texto-suave underline underline-offset-4">
        {modo === "enlace" ? "Entrar con contraseña" : "Entrar con un enlace al correo"}
      </button>
    </div>
  );
}

function Entrar({ siguiente }: { siguiente: string }) {
  const [estado, accion, enviando] = useActionState<EstadoAcceso, FormData>(entrarConContrasena, {});
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

function Crear({ siguiente }: { siguiente: string }) {
  const [estado, accion, enviando] = useActionState<EstadoAcceso, FormData>(crearCuenta, {});
  if (estado.enviado) {
    return (
      <div className="caja p-5 text-center" role="status">
        <p className="font-titulo text-xl font-bold">Confirma tu correo</p>
        <p className="mt-1 text-sm text-texto-suave">Te hemos enviado un enlace a <b>{estado.email}</b>. Ábrelo en este mismo móvil para activar la cuenta y entrar. Si no llega, mira en spam.</p>
      </div>
    );
  }
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="siguiente" value={siguiente} />
      <label className="sr-only" htmlFor="nombre">Tu nombre</label>
      <input id="nombre" name="nombre" autoComplete="given-name" maxLength={60} placeholder="Tu nombre" className={campo} />
      <label className="sr-only" htmlFor="email-nuevo">Email</label>
      <input id="email-nuevo" name="email" type="email" required autoComplete="email" inputMode="email" defaultValue={estado.email} placeholder="tu@email.com" className={campo} />
      <label className="sr-only" htmlFor="contrasena-nueva">Contraseña</label>
      <input id="contrasena-nueva" name="contrasena" type="password" required minLength={8} autoComplete="new-password" placeholder="Contraseña (mínimo 8 caracteres)" className={campo} />
      <button type="submit" disabled={enviando} className={principal}>{enviando ? "Creando…" : "Crear cuenta"}</button>
      {estado.error && <p className="text-sm text-urgente" role="alert">{estado.error}</p>}
    </form>
  );
}

function Enlace({ siguiente }: { siguiente: string }) {
  const [estado, accion, enviando] = useActionState<EstadoEntrar, FormData>(enviarEnlace, { estado: "inicial" });
  if (estado.estado === "enviado") {
    return (
      <div className="caja p-5 text-center" role="status">
        <p className="font-titulo text-xl font-bold">Mira tu correo</p>
        <p className="text-sm text-texto-suave">Te hemos enviado un enlace a <b>{estado.email}</b>. Ábrelo en este mismo móvil para entrar.</p>
      </div>
    );
  }
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="siguiente" value={siguiente} />
      <label className="sr-only" htmlFor="email-enlace">Email</label>
      <input id="email-enlace" name="email" type="email" required autoComplete="email" inputMode="email" defaultValue={estado.email} placeholder="tu@email.com" className={campo} />
      <button type="submit" disabled={enviando} className={principal}>{enviando ? "Enviando…" : "Enviarme un enlace"}</button>
      {estado.estado === "error" && <p className="text-sm text-urgente" role="alert">{estado.mensaje}</p>}
    </form>
  );
}

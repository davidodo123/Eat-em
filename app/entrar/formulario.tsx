"use client";
import { useActionState, useState } from "react";
import { crearCuenta, entrarConContrasena, enviarEnlace, recuperarContrasena, type EstadoAcceso, type EstadoEntrar } from "./acciones";

const campo = "block w-full px-4 py-3.5 text-base";
const principal = "w-full rounded-xl bg-marca px-4 py-3.5 font-semibold text-marca-texto active:opacity-85 disabled:opacity-60";

// Entrar o crear cuenta con email y contrasena (la cuenta nueva se confirma por correo).
// Tambien: entrar con un enlace al correo y recuperar la contrasena (correos de la propia app).
export function FormularioEntrar({ siguiente }: { siguiente: string }) {
  const [modo, setModo] = useState<"entrar" | "crear" | "enlace" | "recuperar">("entrar");
  return (
    <div>
      {(modo === "entrar" || modo === "crear") && (
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-borde bg-superficie p-1" role="tablist">
          {([["entrar", "Entrar"], ["crear", "Crear cuenta"]] as const).map(([k, t]) => (
            <button key={k} type="button" role="tab" aria-selected={modo === k} onClick={() => setModo(k)}
              className={`rounded-lg py-2 text-sm font-semibold ${modo === k ? "bg-texto text-fondo" : "text-texto-suave"}`}>{t}</button>
          ))}
        </div>
      )}
      {modo === "entrar" && <Entrar siguiente={siguiente} />}
      {modo === "crear" && <Crear siguiente={siguiente} />}
      {modo === "enlace" && <PorCorreo key="enlace" siguiente={siguiente} accionCorreo={enviarEnlace} titulo="Entrar con un enlace"
        boton="Enviarme un enlace" hecho="Si hay una cuenta con ese email, te hemos enviado un enlace para entrar." />}
      {modo === "recuperar" && <PorCorreo key="recuperar" siguiente={siguiente} accionCorreo={recuperarContrasena} titulo="Recuperar la contraseña"
        boton="Enviarme el enlace" hecho="Si hay una cuenta con ese email, te hemos enviado un enlace. Al abrirlo entrarás y podrás poner una contraseña nueva en Ajustes." />}
      <div className="mt-4 flex justify-center gap-5 text-sm font-medium text-texto-suave">
        {modo !== "entrar" && <button type="button" onClick={() => setModo("entrar")} className="underline underline-offset-4">Entrar con contraseña</button>}
        {modo === "entrar" && <button type="button" onClick={() => setModo("recuperar")} className="underline underline-offset-4">¿Olvidaste tu contraseña?</button>}
        {modo !== "enlace" && <button type="button" onClick={() => setModo("enlace")} className="underline underline-offset-4">Entrar sin contraseña</button>}
      </div>
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

function PorCorreo({ siguiente, accionCorreo, titulo, boton, hecho }: {
  siguiente: string; accionCorreo: (p: EstadoEntrar, d: FormData) => Promise<EstadoEntrar>; titulo: string; boton: string; hecho: string;
}) {
  const [estado, accion, enviando] = useActionState<EstadoEntrar, FormData>(accionCorreo, { estado: "inicial" });
  if (estado.estado === "enviado") {
    return (
      <div className="caja p-5 text-center" role="status">
        <p className="font-titulo text-xl font-bold">Mira tu correo</p>
        <p className="mt-1 text-sm text-texto-suave">{hecho} Si no llega en un par de minutos, mira en spam.</p>
      </div>
    );
  }
  return (
    <form action={accion} className="space-y-3">
      <p className="font-titulo text-lg font-bold">{titulo}</p>
      <input type="hidden" name="siguiente" value={siguiente} />
      <label className="sr-only" htmlFor="email-correo">Email</label>
      <input id="email-correo" name="email" type="email" required autoComplete="email" inputMode="email" defaultValue={estado.email} placeholder="tu@email.com" className={campo} />
      <button type="submit" disabled={enviando} className={principal}>{enviando ? "Enviando…" : boton}</button>
      {estado.estado === "error" && <p className="text-sm text-urgente" role="alert">{estado.mensaje}</p>}
    </form>
  );
}

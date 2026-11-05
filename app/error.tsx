"use client";
import { useEffect } from "react";
import { Pantalla, Vacio } from "./ui";

// Si una pantalla falla en el servidor o en el navegador. En Next 16 la prop es retry (error.md).
export default function ErrorPantalla({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <Pantalla className="pt-16">
      <Vacio titulo="Algo ha fallado" texto="No se ha podido cargar esta pantalla. Tus datos están a salvo." />
      <button type="button" onClick={() => retry()} className="mt-3 w-full rounded-xl bg-marca py-3 font-semibold text-marca-texto">
        Reintentar
      </button>
    </Pantalla>
  );
}

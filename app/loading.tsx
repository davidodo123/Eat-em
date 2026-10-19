// Se muestra al instante al cambiar de pantalla mientras llegan los datos de Supabase.
// Misma forma que Lista y Despensa: titulo, buscador y una tarjeta con filas.
export default function Cargando() {
  return (
    <main className="mx-auto min-h-dvh max-w-md animate-pulse px-4 pb-28 pt-[max(env(safe-area-inset-top),0.75rem)]" aria-busy="true" aria-label="Cargando">
      <div className="mb-4 pt-2">
        <div className="h-9 w-36 rounded-lg bg-borde" />
        <div className="mt-2 h-4 w-52 rounded bg-borde/70" />
      </div>
      <div className="mb-5 h-[52px] rounded-2xl bg-superficie" />
      <div className="rounded-2xl bg-superficie">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-borde px-4 py-3 last:border-0">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-borde/70" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-3/4 rounded bg-borde" />
              <div className="h-3 w-1/3 rounded bg-borde/70" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

// Esqueleto de Dieta: calendario de la semana y tarjetas de comidas
export default function CargandoDieta() {
  return (
    <main className="mx-auto min-h-dvh max-w-md animate-pulse px-4 pb-28 pt-[max(env(safe-area-inset-top),0.75rem)]" aria-busy="true" aria-label="Cargando">
      <div className="mb-4 flex items-end justify-between pt-2">
        <div className="h-9 w-28 rounded-lg bg-borde" />
        <div className="h-8 w-32 rounded-xl bg-borde/70" />
      </div>
      <div className="mb-5 rounded-2xl bg-superficie p-3">
        <div className="mx-auto mb-3 h-5 w-40 rounded bg-borde/70" />
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }, (_, i) => <div key={i} className="mx-auto h-11 w-10 rounded-xl bg-borde/60" />)}
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="mb-2.5 space-y-2 rounded-2xl bg-superficie p-4">
          <div className="h-3 w-20 rounded bg-borde/70" />
          <div className="h-4 w-2/3 rounded bg-borde" />
          <div className="h-3 w-1/2 rounded bg-borde/60" />
        </div>
      ))}
    </main>
  );
}

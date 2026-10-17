// Se muestra al instante al navegar mientras la pantalla pide sus datos a Supabase
export default function Cargando() {
  return (
    <main className="mx-auto max-w-md animate-pulse px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-10" aria-busy="true" aria-label="Cargando">
      <div className="h-4 w-16 rounded bg-borde" />
      <div className="mt-3 mb-6 h-7 w-40 rounded bg-borde" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="mb-3 h-20 rounded-xl border border-borde bg-superficie" />
      ))}
    </main>
  );
}

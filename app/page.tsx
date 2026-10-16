// Pantalla provisional (Fase 1). Las pantallas reales llegan en la Fase 7.
const PANTALLAS = [
  { nombre: "Hoy", detalle: "Comidas del dia: marcar hecha, editar cantidad, saltar" },
  { nombre: "Inventario", detalle: "Stock del hogar y escaner de codigos de barras" },
  { nombre: "Lista", detalle: "Lista de la compra compartida, copiar para WhatsApp" },
  { nombre: "Dieta", detalle: "Plan semanal individual" },
  { nombre: "Grupo", detalle: "Hogar compartido, invitaciones y actividad" },
  { nombre: "Nutri-em", detalle: "Chat y consejos de psicologia de la dieta" },
  { nombre: "Ajustes", detalle: "Perfil, notificaciones y privacidad" },
];

export default function Inicio() {
  return (
    <main className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),1.5rem)] pb-10">
      <h1 className="text-3xl font-bold text-marca">Eat-em</h1>
      <p className="mt-1 text-texto-suave">Tu dieta, tu despensa y tu lista de la compra, sincronizadas.</p>

      <ul className="mt-6 space-y-2">
        {PANTALLAS.map((p) => (
          <li key={p.nombre} className="rounded-xl border border-borde bg-superficie px-4 py-3">
            <p className="font-semibold">{p.nombre}</p>
            <p className="text-sm text-texto-suave">{p.detalle}</p>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-xs text-texto-suave">
        Eat-em no sustituye a un profesional sanitario.
      </p>
    </main>
  );
}

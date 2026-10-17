"use client";
import { useState } from "react";
import type { LineaTicket } from "@/lib/landing";

const euros = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const UD: Record<string, string> = { kg: "kg", l: "l", unidad: "ud" };

// La "cosa viva": cada linea del ticket es un ingrediente de la cesta; al senalarla o
// tocarla se ve en que tienda sale mas barato (precios reales de la base). Sin JavaScript
// se ve el ticket entero y la primera linea abierta.
export function LineasTicket({ lineas }: { lineas: LineaTicket[] }) {
  const conPrecio = lineas.filter((l) => l.mejor);
  const [elegida, setElegida] = useState(conPrecio[0]?.id ?? null);
  const l = conPrecio.find((x) => x.id === elegida) ?? conPrecio[0];
  const max = l ? Math.max(...l.tiendas.map((t) => t.ppu)) : 1;

  return (
    <>
      <ul className="lineas" aria-label="Cesta de la semana">
        {conPrecio.map((x) => (
          <li key={x.id}>
            <button type="button" className="linea" aria-pressed={x.id === l?.id}
              onClick={() => setElegida(x.id)} onMouseEnter={() => setElegida(x.id)} onFocus={() => setElegida(x.id)}>
              <span className="que">{x.nombre} · {x.texto}</span>
              <span className="importe cifra">{euros(x.coste!)}</span>
              <span className="donde">más barato en {x.mejor!.tienda}</span>
            </button>
          </li>
        ))}
      </ul>
      {l && (
        <div className="vista" aria-live="polite">
          <h3>{l.nombre}: precio por {UD[l.mejor!.unidad] ?? l.mejor!.unidad}</h3>
          <p className="producto">{l.mejor!.producto}</p>
          <ul className="barras">
            {l.tiendas.map((t, i) => (
              <li key={`${l.id}-${t.tienda}`} className={`barra${i === 0 ? " mejor" : ""}`}>
                <span>{t.tienda}</span>
                <span className="relleno" style={{ width: `${Math.max(8, (t.ppu / max) * 100)}%` }} aria-hidden />
                <span className="cifra">{euros(t.ppu)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

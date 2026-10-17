"use client";
import { useState } from "react";

// Fragmentos reales de la interfaz (data-ui): lo que se ve en Hoy, la Despensa y la Lista
const PANTALLAS = {
  hoy: {
    pestana: "Hoy", titulo: "Lo que coméis, descontado",
    texto: "Marcáis la comida como hecha y lo que lleva sale solo de la despensa de casa. Si algo baja de lo que soléis tener, entra en la lista.",
    ui: { titulo: "Hoy", sub: "Viernes 17 de octubre", filas: [
      { a: "Avena con leche y plátano", b: "70 g avena · 300 ml leche · 1 plátano", c: "Hecha", estado: "hecha" },
      { a: "Pollo con arroz y brócoli", b: "180 g pollo · 90 g arroz · 200 g brócoli", c: "13:30", estado: "" },
      { a: "Tortilla y ensalada", b: "2 huevos · 200 g tomate · 80 g pan", c: "21:00", estado: "" },
    ] },
  },
  despensa: {
    pestana: "Despensa", titulo: "La despensa, compartida",
    texto: "Lo que escaneáis al volver de la compra entra en la despensa de los dos, con su precio. Cada uno ve al momento lo que cambia el otro.",
    ui: { titulo: "Despensa", sub: "Hogar de Castell de Ferro", filas: [
      { a: "Leche semidesnatada", b: "Lácteos", c: "4,5 l", estado: "" },
      { a: "Arroz blanco", b: "Arroz, pasta y cereales", c: "1,2 kg", estado: "" },
      { a: "Huevos", b: "Queda poco", c: "3 uds", estado: "urgente" },
    ] },
  },
  lista: {
    pestana: "Lista", titulo: "La lista se hace sola",
    texto: "Suma lo que piden vuestras dietas de la semana, resta lo que hay en casa y propone paquetes del tamaño de verdad. Se manda por WhatsApp.",
    ui: { titulo: "Lista", sub: "Para los próximos 7 días", filas: [
      { a: "Huevos", b: "Para hoy · Ahorramás", c: "1 paquete", estado: "urgente" },
      { a: "Pechuga de pollo", b: "Carrefour", c: "900 g", estado: "" },
      { a: "Garbanzos cocidos", b: "Caprabo", c: "2 botes", estado: "" },
    ] },
  },
} as const;
type Clave = keyof typeof PANTALLAS;

export function Escaparate() {
  const [p, setP] = useState<Clave>("hoy");
  const s = PANTALLAS[p];
  return (
    <section className="escaparate" id="como" aria-labelledby="titulo-escaparate">
      <div className="placa">
        <div className="ui" data-ui role="img" aria-label={`Pantalla ${s.ui.titulo} de Eat-em`}>
          <p className="ui-titulo">{s.ui.titulo}</p>
          <p className="ui-sub">{s.ui.sub}</p>
          {s.ui.filas.map((f) => (
            <div key={f.a} className={`ui-fila ${f.estado}`}><b>{f.a}</b><span>{f.b}</span><em>{f.c}</em></div>
          ))}
        </div>
      </div>
      <div className="lado" data-entra>
        <div className="pestanas" role="tablist" aria-label="Pantallas de la app">
          {(Object.keys(PANTALLAS) as Clave[]).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={k === p} onClick={() => setP(k)}>{PANTALLAS[k].pestana}</button>
          ))}
        </div>
        <div>
          <h2 id="titulo-escaparate">{s.titulo}</h2>
          <p className="descripcion">{s.texto}</p>
        </div>
        <div className="celdas">
          <a href="#entrar">Entrar</a>
          <a href="#precios">Ver los precios</a>
        </div>
      </div>
    </section>
  );
}

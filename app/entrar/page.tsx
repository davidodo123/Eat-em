import type { Metadata } from "next";
import Image from "next/image";
import { Imbue, Albert_Sans } from "next/font/google";
import { rutaInterna } from "@/lib/rutas";
import { euros, ticketDeMuestra, type Ticket } from "@/lib/landing";
import { FormularioEntrar } from "./formulario";
import { LineasTicket } from "./ticket";
import { Escaparate } from "./escaparate";
import { Movimiento } from "./movimiento";
import "./landing.css";

const imbue = Imbue({ subsets: ["latin"], variable: "--f-display", display: "swap" });
const albert = Albert_Sans({ subsets: ["latin"], weight: ["400", "500"], variable: "--f-text", display: "swap" });

export const metadata: Metadata = {
  title: "Eat-em · La compra sale sola",
  description: "La lista de la compra sale de lo que coméis los dos, se descuenta de la despensa y dice dónde sale más barata. Hecha en Castell de Ferro.",
};

// Borde de papel cortado (arriba) y festones (abajo) como poligonos de clip-path
function dientes(n = 44, alto = 10) {
  const p = ["0 " + alto + "px"];
  for (let i = 1; i <= n; i++) p.push(`${((i - 0.5) / n) * 100}% 0`, `${(i / n) * 100}% ${alto}px`);
  return `polygon(${p.join(",")}, 100% 100%, 0 100%)`;
}
function festones(n = 30, alto = 12) {
  const p = ["0 0", "100% 0", `100% calc(100% - ${alto}px)`];
  for (let i = n; i >= 1; i--) p.push(`${((i - 0.5) / n) * 100}% 100%`, `${((i - 1) / n) * 100}% calc(100% - ${alto}px)`);
  return `polygon(${p.join(",")})`;
}

const PREGUNTAS: [string, string][] = [
  ["¿Cuánto cuesta?", "Nada. La IA funciona con un modelo gratuito que admite unas 50 peticiones al día para todo el hogar; si un día se acaban, al siguiente vuelve."],
  ["¿Qué supermercados tiene?", "Carrefour, Ahorramás, Caprabo y Gadis, con el precio de su web cada día. Mercadona, con su catálogo y los precios que apuntáis al escanear."],
  ["¿Por qué Mercadona no tiene precios?", "Su web no permite leerlos de forma automática y Eat-em respeta esa norma. Los precios de vuestro Mercadona de Motril llegan desde vuestras compras."],
  ["¿De dónde salen las calorías?", "De Open Food Facts, una base de datos abierta de alimentos, cruzada por el código de barras de cada producto."],
  ["¿Quién ve mis datos de salud?", "Solo tú. Se guardan con tu consentimiento, para calcular tus objetivos, y si lo retiras se borran."],
  ["¿Sustituye a un nutricionista?", "No. Ante un embarazo, una enfermedad, una medicación o cualquier señal de riesgo no propone dieta y recomienda ir a un profesional."],
  ["¿Qué compartimos y qué no?", "La despensa y la lista son del hogar y las veis los dos al momento. La dieta y los datos de salud son de cada uno."],
  ["¿Funciona en el iPhone?", "Sí, desde Safari. Añadidla a la pantalla de inicio para recibir los avisos de la lista y de la compra."],
  ["¿Cómo se entra?", "Con el email: llega un enlace y se abre en el mismo navegador. El segundo miembro se une con el código del hogar."],
];

const FOTOS = [
  { archivo: "castillo.jpg", texto: "El castillo, sobre los invernaderos", credito: "Ismael Olea, CC BY 4.0" },
  { archivo: "playa-sotillo.jpg", texto: "Playa del Sotillo", credito: "Feranza, CC BY-SA 4.0" },
  { archivo: "chirimoya.jpg", texto: "Chirimoyas de la Costa Tropical", credito: "Juan Emilio Prades Bel, CC BY-SA 4.0" },
  { archivo: "cana-motril.jpg", texto: "Museo de la Caña de Azúcar, Motril", credito: "Zarateman, CC0" },
];

async function datos(): Promise<Ticket | null> {
  try {
    return await ticketDeMuestra();
  } catch {
    return null; // sin base de datos la pagina se ve igual, sin la cesta
  }
}

export default async function Entrar({ searchParams }: { searchParams: Promise<{ siguiente?: string; error?: string }> }) {
  const [{ siguiente, error }, t] = await Promise.all([searchParams, datos()]);
  const lineas = (t?.lineas ?? []).filter((l) => l.mejor);
  const ahorro = t?.tiendaUnica ? Math.round((t.tiendaUnica.total - t.total) * 100) / 100 : 0;
  const productos = (t?.productos ?? 0).toLocaleString("es-ES");

  return (
    <div className={`lp ${imbue.variable} ${albert.variable}`} style={{ ["--dientes" as string]: dientes(), ["--festones" as string]: festones() }}>
      <Movimiento />
      <div className="contenido">
        <header className="cabecera">
          <a href="#arriba" className="marca rotulo" aria-label="Eat-em, inicio">Eat-em</a>
          <nav aria-label="Secciones">
            <a href="#como">Cómo funciona</a>
            <a href="#precios">Precios</a>
            <a href="#preguntas">Preguntas</a>
          </nav>
          <a href="#entrar" className="boton">Entrar</a>
        </header>

        <section className="hero" id="arriba">
          <article className="ticket ticket-entra" aria-labelledby="titular">
            <h1 id="titular" className="titular rotulo">La compra<br />sale sola</h1>
            <p className="apoyo">Eat-em hace la lista con lo que coméis los dos, descuenta lo que gastáis y dice dónde sale más barata.</p>
            {error && <p className="apoyo" role="alert"><b>El enlace no vale o ha caducado.</b> Pide uno nuevo abajo.</p>}
            <p className="cabeza">
              Hogar de Castell de Ferro<br />18740, Granada<br />
              {t ? <>Cesta de la semana para dos, con {productos} productos de {t.tiendas} supermercados</> : "Cesta de la semana para dos"}
            </p>
            <div className="perforado" role="separator" aria-hidden />
            {lineas.length > 0 ? (
              <>
                <LineasTicket lineas={lineas} />
                <div className="perforado" role="separator" aria-hidden />
                <div className="totales cifra">
                  <span className="grande">Total</span><span className="grande">{euros(t!.total)}</span>
                  {t!.tiendaUnica && ahorro > 0 && (
                    <p className="nota">Todo en {t!.tiendaUnica.tienda} serían {euros(t!.tiendaUnica.total)}: comprando cada cosa donde sale mejor, {euros(ahorro)} menos.</p>
                  )}
                  <p className="nota">Precios de hoy en las webs de las tiendas. Cantidades de ejemplo.</p>
                </div>
              </>
            ) : (
              <p className="cabeza">Los precios aparecerán aquí en cuanto se carguen las tiendas.</p>
            )}
          </article>
        </section>

        <Escaparate />

        {lineas.length > 0 && (
          <section className="precios" id="precios" aria-labelledby="titulo-precios">
            <h2 id="titulo-precios" className="gigante rotulo">Precios</h2>
            <div data-entra>
              <p className="intro">Cada producto de la cesta en cada tienda, por kilo, litro o unidad y con la oferta aplicada. Mercadona no publica precios en su web: allí los apuntáis vosotros al escanear.</p>
            </div>
            {lineas.map((l, i) => (
              <details key={l.id} className="cajon" open={i === 0}>
                <summary><span>{l.nombre}</span><span className="mas" aria-hidden>+</span></summary>
                <ul>
                  {l.tiendas.map((s, j) => (
                    <li key={s.tienda} className={j === 0 ? "mejor" : ""}>
                      <span style={{ color: "var(--ink)" }}>{s.tienda}</span>
                      <span>{s.producto}</span>
                      <b className="cifra">{euros(s.ppu)} / {s.unidad === "unidad" ? "ud" : s.unidad}</b>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
            <p className="letra-pequena">Precios de las webs de Carrefour, Ahorramás, Caprabo y Gadis, que se actualizan cada día.</p>
          </section>
        )}

        <section className="sitio" aria-labelledby="titulo-sitio">
          <figure>
            <Image src="/entrar/castell-lujar.jpg" alt="Castell de Ferro desde el aire: el pueblo junto al mar, los invernaderos y la sierra de Lújar con una nube encima"
              width={1920} height={1280} sizes="100vw" priority={false} />
          </figure>
          <div className="pie" data-entra>
            <h2 id="titulo-sitio" className="rotulo">Desde Castell de Ferro</h2>
            <div>
              <p>Pensada para un hogar de dos en la Costa Tropical, que hace la compra en Motril. Mercadona, Carrefour, Ahorramás, Caprabo y Gadis: {t ? `${productos} productos` : "decenas de miles de productos"}, cada uno con su formato y, donde se puede, su precio.</p>
              <small>Foto: “Castell de Ferro and clouds over mountain Lújar 2”, kallerna, CC BY-SA 4.0, Wikimedia Commons.</small>
            </div>
          </div>
        </section>

        <section className="carta-campo" aria-label="Carta">
          <article className="carta" data-entra>
            <p>Os he hecho Eat-em porque la compra de la semana no debería costar una tarde ni una discusión.</p>
            <p>Cada uno tiene su dieta, con sus cantidades. La app suma lo que necesitáis los dos, mira lo que queda en casa y hace la lista. Si algo se acaba, entra solo.</p>
            <p>Los precios salen cada noche de las webs de los supermercados. Los del Mercadona de Motril los ponéis vosotros al escanear lo que compráis, y así aprende lo que cuesta aquí.</p>
            <p>La dieta la propone una IA, pero las cuentas y las reglas de seguridad las hace el código. Si algo de salud no encaja, no inventa nada: os manda a un profesional.</p>
            <div className="laminas">
              {FOTOS.map((f) => (
                <figure key={f.archivo}>
                  <Image src={`/entrar/${f.archivo}`} alt={f.texto} width={600} height={600} sizes="(max-width: 760px) 45vw, 290px" />
                  <figcaption>{f.texto}. {f.credito}.</figcaption>
                </figure>
              ))}
            </div>
            <p className="firma">David</p>
            <p className="cargo">Lo ha hecho tu hermano, para casa</p>
          </article>
          <div className="tira" id="entrar">
            <h2 className="rotulo">Entrar</h2>
            <p className="ayuda">Te mandamos un enlace al correo. Sin contraseñas.</p>
            <FormularioEntrar siguiente={rutaInterna(siguiente)} />
          </div>
        </section>

        <section className="preguntas" id="preguntas" aria-labelledby="titulo-preguntas">
          <div className="izq" data-entra>
            <h2 id="titulo-preguntas">Preguntas</h2>
            <figure>
              <Image src="/entrar/mapa-castell-de-ferro.jpg" alt="Mapa topográfico nacional, hoja 1056-III, Castell de Ferro" width={1920} height={1348} sizes="(max-width: 760px) 90vw, 25vw" />
              <figcaption>Mapa Topográfico Nacional, hoja Castell de Ferro. CNIG, CC BY 4.0.</figcaption>
            </figure>
          </div>
          <div className="texto">
            {PREGUNTAS.map(([q, r]) => <p key={q}><b>{q}</b> {r}</p>)}
          </div>
        </section>
      </div>

      <footer className="pie-pagina">
        <div className="columnas">
          <div><p>Dónde</p><p>Castell de Ferro</p><p>18740, Granada</p><p>Costa Tropical</p></div>
          <div><p>La app</p><ul><li>Hoy</li><li>Semana</li><li>Lista</li><li>Despensa</li><li>Nutri-em</li></ul></div>
          <div><p>Datos</p><ul><li>Precios: webs de las tiendas</li><li>Alimentos: Open Food Facts, ODbL</li><li>Mapa: IGN, CNIG</li></ul></div>
          <div><p>Fotos</p><ul><li>kallerna, CC BY-SA 4.0</li><li>Ismael Olea, CC BY 4.0</li><li>Feranza, CC BY-SA 4.0</li><li>Juan Emilio Prades Bel, CC BY-SA 4.0</li><li>Zarateman, CC0</li><li>Todas en Wikimedia Commons</li></ul></div>
        </div>
        <div />
        <div>
          <svg className="nombre" viewBox="0 0 400 96" role="img" aria-label="Eat-em">
            <text x="0" y="88" textLength="400" lengthAdjust="spacingAndGlyphs" style={{ font: "400 112px var(--f-display), serif", textTransform: "uppercase" }}>EAT-EM</text>
          </svg>
          <p className="legal">Eat-em no sustituye a un profesional sanitario. Uso personal, sin ánimo de lucro.</p>
        </div>
      </footer>
    </div>
  );
}

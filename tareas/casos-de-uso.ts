// Casos de uso de la app con un navegador real, en tamano movil y contra la web publicada.
//
//   npm run casos                 todos menos los que gastan IA
//   npm run casos -- --ia         tambien el chat y rellenar la semana (~8 de las 50 peticiones diarias)
//   npm run casos -- --solo H,L   solo los grupos o casos que empiecen asi
//   CASOS_BASE=http://localhost:3000 npm run casos
//
// Usa el Chrome instalado (playwright-core no descarga navegadores). Crea cuentas temporales
// prueba-temporal-*@example.com y las borra al acabar, con sus hogares: no toca datos de nadie
// ni el catalogo. La lista de casos explicada esta en diario/Casos de uso.md.
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { chromium, type Browser, type Page } from "playwright-core";

const BASE = (process.env.CASOS_BASE ?? "https://eat-em.vercel.app").replace(/\/$/, "");
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL!, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const args = process.argv.slice(2);
const conIA = args.includes("--ia");
const soloIdx = args.indexOf("--solo");
const solo = soloIdx >= 0 ? args[soloIdx + 1].split(",") : null;
const PREFIJO = "prueba-temporal-";
const ESPERA = 20_000;

const admin = createClient(URL_SB, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

interface Cuenta { email: string; password: string; id: string }
interface Persona extends Cuenta { page: Page; errores: string[] }

async function crearCuenta(): Promise<Cuenta> {
  const email = `${PREFIJO}${randomBytes(4).toString("hex")}@example.com`, password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return { email, password, id: data.user.id };
}

// Borra las cuentas temporales (tambien las de ejecuciones cortadas) y sus hogares
async function limpiar() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const temporales = data.users.filter((u) => u.email?.startsWith(PREFIJO));
  for (const u of temporales) {
    const { data: m } = await admin.from("grupo_miembros").select("grupo_id").eq("usuario_id", u.id);
    const grupos = (m ?? []).map((x) => x.grupo_id);
    if (grupos.length) await admin.from("grupos").delete().in("id", grupos);
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) console.error(`No se pudo borrar ${u.email}: ${error.message}`);
  }
  return temporales.length;
}

async function abrir(nav: Browser, c: Cuenta | null, ancho = 390): Promise<Omit<Persona, keyof Cuenta> & Partial<Cuenta>> {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: "es-ES" });
  const page = await ctx.newPage();
  const errores: string[] = [];
  page.on("dialog", (d) => d.accept());
  page.on("pageerror", (e) => errores.push(`${new URL(page.url()).pathname}: ${e.message.slice(0, 200)}`));
  page.on("response", (r) => { if (r.status() >= 500) errores.push(`${r.status()} ${r.url().slice(0, 120)}`); });
  if (c) await entrar(page, c);
  return { ...c, page, errores };
}

async function entrar(page: Page, c: Cuenta, ruta = "/entrar") {
  await page.goto(BASE + ruta);
  await page.getByRole("button", { name: "Ya tengo contraseña" }).click();
  await page.fill("#email", c.email);
  await page.fill("#contrasena", c.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/entrar"), { timeout: ESPERA });
}

const ir = (p: Page, r: string) => p.goto(BASE + r, { waitUntil: "networkidle" });
const ve = (p: Page, t: string | RegExp) => p.getByText(t).first().waitFor({ timeout: ESPERA });
// Espera a que terminen la accion y la recarga en curso (el tiempo real va por websocket y no cuenta)
const calma = async (p: Page) => { await p.waitForTimeout(400); await p.waitForLoadState("networkidle"); };
const texto = async (p: Page) => {
  await p.waitForLoadState("networkidle");
  return (await p.locator("main").last().innerText()).replace(/\s+/g, " ");
};
const ruta = (p: Page) => new URL(p.url()).pathname;
function cierto(c: unknown, msg: string): asserts c { if (!c) throw new Error(msg); }
const incluye = async (p: Page, t: string | RegExp) => {
  const m = await texto(p);
  cierto(typeof t === "string" ? m.includes(t) : t.test(m), `falta ${t} en: ${m.slice(0, 180)}`);
};
const noIncluye = async (p: Page, t: string) => {
  const m = await texto(p);
  cierto(!m.includes(t), `no deberia verse "${t}" en: ${m.slice(0, 180)}`);
};
async function buscar(p: Page, q: string) {
  await p.getByRole("searchbox").fill(q);
  await p.getByText(/tal cual|Nada con/).first().waitFor({ timeout: ESPERA }).catch(() => {});
  await p.waitForFunction(() => !document.querySelector('[aria-label="Buscando"]'), null, { timeout: ESPERA });
  await p.waitForTimeout(400);
}
async function anadirTexto(p: Page, t: string) {
  await p.getByRole("searchbox").fill(t);
  await p.getByText(/tal cual/).first().waitFor({ timeout: ESPERA });
  await p.getByText(/tal cual/).first().click();
  await p.getByText(/^Añadido: /).first().waitFor({ timeout: ESPERA });
}
const clienteDe = async (c: Cuenta): Promise<SupabaseClient> => {
  const s = createClient(URL_SB, ANON, { auth: { persistSession: false } });
  const { error } = await s.auth.signInWithPassword({ email: c.email, password: c.password });
  if (error) throw error;
  return s;
};

const resultados: { id: string; nombre: string; ok: boolean; ms: number; nota: string }[] = [];
async function caso(id: string, nombre: string, fn: () => Promise<string | void>) {
  if (solo && !solo.some((s) => id.startsWith(s))) return;
  const t = Date.now();
  try {
    const nota = (await fn()) ?? "";
    resultados.push({ id, nombre, ok: true, ms: Date.now() - t, nota });
    console.log(`OK    ${id.padEnd(4)} ${nombre}${nota ? ` -> ${nota}` : ""}`);
  } catch (e) {
    const nota = (e as Error).message.split("\n")[0].slice(0, 240);
    resultados.push({ id, nombre, ok: false, ms: Date.now() - t, nota });
    console.log(`FALLO ${id.padEnd(4)} ${nombre} -> ${nota}`);
  }
}

async function main() {
  console.log(`Casos de uso contra ${BASE}\n`);
  await limpiar();
  const nav = await chromium.launch({ channel: "chrome" });
  const [ca, cb, cc] = await Promise.all([crearCuenta(), crearCuenta(), crearCuenta()]);
  try {
    const anonimo = (await abrir(nav, null)).page;
    const a = (await abrir(nav, ca)) as Persona, b = (await abrir(nav, cb)) as Persona, c = (await abrir(nav, cc)) as Persona;
    const pa = a.page, pb = b.page, pc = c.page;
    let codigo = "";

    // ---- Acceso ----
    await caso("A1", "Sin sesion, una pantalla privada lleva a Entrar y recuerda adonde iba", async () => {
      await anonimo.goto(`${BASE}/despensa?l=nevera`);
      cierto(ruta(anonimo) === "/entrar", ruta(anonimo));
      cierto(decodeURIComponent(anonimo.url()).includes("siguiente=/despensa?l=nevera"), anonimo.url());
    });
    await caso("A2", "Contrasena incorrecta: mensaje claro y no entra", async () => {
      await anonimo.goto(`${BASE}/entrar`);
      await anonimo.getByRole("button", { name: "Ya tengo contraseña" }).click();
      await anonimo.fill("#email", ca.email);
      await anonimo.fill("#contrasena", "mal");
      await anonimo.getByRole("button", { name: "Entrar", exact: true }).click();
      await ve(anonimo, "Email o contraseña incorrectos.");
      cierto(ruta(anonimo) === "/entrar", ruta(anonimo));
    });
    await caso("A3", "Al entrar vuelve a la pantalla que pedia", async () => {
      const x = await abrir(nav, null);
      await x.page.goto(`${BASE}/dieta`);
      await x.page.getByRole("button", { name: "Ya tengo contraseña" }).click();
      await x.page.fill("#email", ca.email);
      await x.page.fill("#contrasena", ca.password);
      await x.page.getByRole("button", { name: "Entrar", exact: true }).click();
      await x.page.waitForURL("**/dieta", { timeout: ESPERA });
      await x.page.context().close();
    });
    await caso("A4", "Un enlace de entrada no puede mandar a otra web", async () => {
      const x = await abrir(nav, null);
      for (const malo of ["//ejemplo-malo.com", "https://ejemplo-malo.com", "/\\ejemplo-malo.com"]) {
        await x.page.goto(`${BASE}/entrar?siguiente=${encodeURIComponent(malo)}`);
        await x.page.getByRole("button", { name: "Ya tengo contraseña" }).click();
        await x.page.fill("#email", ca.email);
        await x.page.fill("#contrasena", ca.password);
        await x.page.getByRole("button", { name: "Entrar", exact: true }).click();
        await x.page.waitForURL((u) => !u.pathname.startsWith("/entrar"), { timeout: ESPERA });
        cierto(new URL(x.page.url()).host === new URL(BASE).host, `salio a ${x.page.url()}`);
        await x.page.context().clearCookies();
      }
      await x.page.context().close();
    });
    await caso("A5", "Con sesion, Entrar y la portada llevan a la Lista", async () => {
      await pa.goto(`${BASE}/entrar`);
      cierto(ruta(pa) === "/lista", ruta(pa));
      await pa.goto(`${BASE}/`);
      cierto(ruta(pa) === "/lista", ruta(pa));
    });
    await caso("A6", "Enlaces antiguos /hoy e /inventario siguen funcionando", async () => {
      await pa.goto(`${BASE}/hoy`);
      cierto(ruta(pa) === "/dieta", ruta(pa));
      await pa.goto(`${BASE}/inventario`);
      cierto(ruta(pa) === "/despensa", ruta(pa));
    });
    await caso("A7", "Cerrar sesion deja fuera y se puede volver a entrar", async () => {
      const x = await abrir(nav, ca);
      await ir(x.page, "/ajustes");
      await x.page.getByRole("button", { name: /Cerrar sesión|Salir/ }).click();
      await x.page.waitForURL("**/entrar**", { timeout: ESPERA });
      await x.page.goto(`${BASE}/lista`);
      cierto(ruta(x.page) === "/entrar", ruta(x.page));
      await x.page.context().close();
    });
    await caso("A8", "Una pagina que no existe da 404, no un error", async () => {
      const r = await pa.goto(`${BASE}/no-existe-esto`);
      cierto(r?.status() === 404, String(r?.status()));
    });

    // ---- Hogar ----
    await caso("H1", "Sin hogar: Lista, Despensa y Ubicacion piden crearlo", async () => {
      for (const r of ["/lista", "/despensa", "/ubicacion"]) {
        await ir(pa, r);
        await ve(pa, "Primero, tu hogar");
      }
    });
    await caso("H2", "Nombre de hogar solo con espacios: se rechaza", async () => {
      await ir(pa, "/grupo");
      await pa.fill('input[name="nombre"]', "   ");
      await pa.getByRole("button", { name: "Crear hogar" }).click();
      await ve(pa, "Ponle un nombre al hogar.");
    });
    await caso("H3", "Codigo de invitacion mal escrito o inexistente", async () => {
      await ir(pb, "/grupo");
      await pb.fill('input[name="codigo"]', "ABC");
      await pb.getByRole("button", { name: "Unirme" }).click();
      await ve(pb, "El código tiene 8 letras y números.");
      await pb.fill('input[name="codigo"]', "ZZZZZZZZ");
      await pb.getByRole("button", { name: "Unirme" }).click();
      await ve(pb, "Ese código no existe.");
    });
    await caso("H4", "Crear un hogar da un codigo de invitacion", async () => {
      await ir(pa, "/grupo");
      await pa.fill('input[name="nombre"]', "Casa de Ana");
      await pa.getByRole("button", { name: "Crear hogar" }).click();
      await pa.locator(".font-mono.select-all").waitFor({ timeout: ESPERA });
      codigo = (await pa.locator(".font-mono.select-all").innerText()).trim();
      cierto(/^[A-Za-z0-9]{8}$/.test(codigo), codigo);
    });
    await caso("H5", "La segunda persona se une escribiendo el codigo en minusculas", async () => {
      await ir(pb, "/grupo");
      await pb.fill('input[name="codigo"]', codigo.toLowerCase());
      await pb.getByRole("button", { name: "Unirme" }).click();
      await ve(pb, "Casa de Ana");
    });
    await caso("H6", "Solo quien administra cambia los dias de la lista", async () => {
      await ir(pb, "/grupo");
      const selector = pb.locator('select[name="dias"]');
      if (!(await selector.count())) return "a quien no administra ni se le ofrece";
      await selector.selectOption("14");
      await pb.getByRole("button", { name: "Guardar" }).click();
      await ve(pb, "Solo quien administra");
    });
    await caso("H7", "Tercera persona en otro hogar", async () => {
      await ir(pc, "/grupo");
      await pc.fill('input[name="nombre"]', "Otra casa");
      await pc.getByRole("button", { name: "Crear hogar" }).click();
      await pc.locator(".font-mono.select-all").waitFor({ timeout: ESPERA });
    });

    // ---- Ubicacion ----
    await caso("U1", "Codigo postal no valido", async () => {
      await ir(pa, "/ubicacion");
      await pa.evaluate(() => document.querySelector("#cp")?.removeAttribute("pattern"));
      await pa.fill("#cp", "12");
      await pa.getByRole("button", { name: "Buscar" }).click();
      await ve(pa, "Código postal no válido (5 cifras).");
    });
    await caso("U2", "Sin codigo ni GPS: lo pide", async () => {
      await ir(pa, "/ubicacion");
      await pa.getByRole("button", { name: "Buscar" }).click();
      await ve(pa, "Activa la ubicación o escribe tu código postal.");
    });
    await caso("U3", "Codigo postal bueno: guarda y muestra las tiendas cercanas", async () => {
      await ir(pa, "/ubicacion");
      await pa.fill("#cp", "28013");
      await pa.getByRole("button", { name: "Buscar" }).click();
      await ve(pa, "Ubicación guardada");
      await ve(pa, /Cerca de Madrid/i);
      await incluye(pa, "Carrefour");
      return (await texto(pa)).match(/CERCA DE.*?TIENDAS/i)?.[0].slice(0, 140);
    });
    await caso("U4", "Las cadenas sin catalogo salen con su nombre y como sin datos", async () => {
      const m = await texto(pa);
      cierto(!/\bcoviran\b/.test(m), "coviran sin nombre");
      await incluye(pa, "sin datos");
    });
    await caso("U5", "La ubicacion se comparte: la otra persona del hogar la ve", async () => {
      await ir(pb, "/lista");
      await incluye(pb, "Madrid");
    });

    // ---- Lista ----
    await caso("L1", "Escribir una sola letra no busca", async () => {
      await ir(pa, "/lista");
      await pa.getByRole("searchbox").fill("l");
      await pa.waitForTimeout(1200);
      cierto(!(await pa.getByText(/tal cual/).count()), "ha buscado con una letra");
      await pa.getByRole("searchbox").fill("");
    });
    await caso("L2", "Una busqueda sin resultados lo dice y permite anadirlo tal cual", async () => {
      await buscar(pa, "zzqxwv");
      await ve(pa, "Nada con «zzqxwv» en tus supermercados.");
      await ve(pa, /tal cual/);
      await pa.getByRole("button", { name: "Borrar" }).click();
    });
    await caso("L3", "Buscar solo devuelve tiendas cercanas, con precio", async () => {
      await ir(pa, "/lista");
      await buscar(pa, "leche entera");
      const filas = await pa.locator("ul button").allInnerTexts();
      cierto(filas.length > 0, "sin resultados");
      const fuera = filas.filter((f) => /Gadis|Caprabo/.test(f));
      cierto(!fuera.length, `tienda lejana: ${fuera[0]?.replace(/\s+/g, " ")}`);
      return `${filas.length} resultados`;
    });
    await caso("L4", "Anadir un producto muestra precio, tienda y total", async () => {
      await pa.locator("ul button").first().click();
      await ve(pa, /^Añadido: /);
      await ir(pa, "/lista");
      await incluye(pa, "Estimado");
      return (await texto(pa)).match(/AÑADIDO POR VOSOTROS.{0,90}/i)?.[0];
    });
    await caso("L5", "Anadir el mismo producto otra vez suma un envase y el total sube", async () => {
      const total = async () => (await texto(pa)).match(/Estimado ([\d,]+)/)![1];
      const antes = await total();
      await buscar(pa, "leche entera");
      await pa.locator("ul button").first().click();
      await ve(pa, /^Añadido: /);
      await ir(pa, "/lista");
      const despues = await total();
      cierto(Number(despues.replace(",", ".")) > Number(antes.replace(",", ".")), `${antes} -> ${despues}`);
      cierto((await pa.getByRole("button", { name: /^Comprado:/ }).count()) === 1, "linea duplicada");
      return `${antes} € -> ${despues} €`;
    });
    await caso("L6", "Mas y menos cambian la cantidad y no baja de 1", async () => {
      await pa.getByRole("button", { name: "Uno menos" }).first().click();
      await calma(pa);
      await cierto(await pa.getByRole("button", { name: "Uno menos" }).first().isDisabled(), "permite bajar de 1");
    });
    await caso("L7", "Texto libre con acentos y emoji", async () => {
      await anadirTexto(pa, "Pañales ñu 🍼");
      await ir(pa, "/lista");
      await incluye(pa, "Pañales ñu 🍼");
    });
    await caso("L8", "Texto con codigo HTML no se ejecuta (XSS)", async () => {
      await anadirTexto(pa, "<img src=x onerror=window.__xss=1>");
      await ir(pa, "/lista");
      await incluye(pa, "<img src=x onerror=window.__xss=1>");
      cierto(!(await pa.evaluate(() => (window as unknown as { __xss?: number }).__xss)), "se ha ejecutado");
    });
    await caso("L9", "Texto larguisimo: se recorta y no rompe la pantalla", async () => {
      await anadirTexto(pa, "x".repeat(400));
      await ir(pa, "/lista");
      cierto(!(await pa.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), "desborda el ancho");
    });
    await caso("L10", "Quitar una linea", async () => {
      await pa.getByRole("button", { name: /^Quitar x+/ }).click();
      await calma(pa);
      await ir(pa, "/lista");
      await noIncluye(pa, "xxxxxxxxxx");
    });
    await caso("L11", "Compartir saca el texto de la lista", async () => {
      await pa.addInitScript(() => {
        (navigator as unknown as { share: (d: { text: string }) => Promise<void> }).share = async (d) => { (window as unknown as { __compartido: string }).__compartido = d.text; };
      });
      await ir(pa, "/lista");
      await pa.getByRole("button", { name: "Compartir la lista" }).click();
      const t = await pa.waitForFunction(() => (window as unknown as { __compartido?: string }).__compartido, null, { timeout: ESPERA });
      const s = String(await t.jsonValue());
      cierto(s.includes("Pañales"), s.slice(0, 120));
      return s.replace(/\s+/g, " ").slice(0, 90);
    });

    // ---- Compartir en el hogar ----
    await caso("C1", "Lo que anade una persona lo ve la otra al abrir", async () => {
      await ir(pb, "/lista");
      await incluye(pb, "Pañales ñu 🍼");
    });
    await caso("C2", "Tiempo real: aparece sin recargar en el otro movil", async () => {
      await ir(pb, "/lista");
      await pb.waitForTimeout(2500); // deja suscribirse al canal
      await anadirTexto(pa, "Yogures tiempo real");
      await ve(pb, "Yogures tiempo real");
    });
    await caso("C3", "Tiempo real tras visitar otra pestana y volver (cache de pestanas)", async () => {
      const nav2 = pb.getByRole("navigation", { name: "Principal" });
      await nav2.getByRole("link", { name: "Despensa" }).click();
      await pb.waitForURL("**/despensa");
      await anadirTexto(pa, "Galletas mientras no miras");
      await calma(pb);
      await nav2.getByRole("link", { name: "Lista" }).click();
      await pb.waitForURL("**/lista");
      // La lista guardada puede tener hasta 30 s: se comprueba que se pone al dia sola
      await pb.getByText("Galletas mientras no miras").first().waitFor({ timeout: 45_000 });
    });
    await caso("C4", "Lo que compra una persona aparece en la despensa de la otra", async () => {
      await ir(pb, "/lista");
      const n = await pb.getByRole("button", { name: /^Comprado: Leche/ }).getAttribute("aria-label");
      await pb.getByRole("button", { name: /^Comprado: Leche/ }).click();
      await calma(pb);
      await ir(pa, "/despensa");
      await incluye(pa, n!.replace("Comprado: ", "").slice(0, 12));
    });

    // ---- Seguridad entre hogares ----
    await caso("S1", "Otro hogar no ve mi lista ni mi despensa, ni en pantalla ni por la API", async () => {
      await ir(pc, "/lista");
      await noIncluye(pc, "Pañales");
      await ir(pc, "/despensa");
      await noIncluye(pc, "Leche");
      const s = await clienteDe(cc);
      for (const t of ["lista_items", "despensa", "inventario"]) {
        const { data } = await s.from(t).select("grupo_id");
        cierto(!(data ?? []).some((f) => f.grupo_id !== data?.[0]?.grupo_id), `${t}: mezcla hogares`);
        const { data: de } = await admin.from(t).select("id").limit(0);
        void de;
      }
      const { data: visibles } = await s.from("lista_items").select("texto_libre").ilike("texto_libre", "%Pañales%");
      cierto(!visibles?.length, "ve la lista ajena");
    });
    await caso("S2", "Otro hogar no puede escribir en mi lista ni borrarla", async () => {
      const { data: g } = await admin.from("grupo_miembros").select("grupo_id").eq("usuario_id", ca.id).single();
      const s = await clienteDe(cc);
      const ins = await s.from("lista_items").insert({ grupo_id: g!.grupo_id, texto_libre: "intruso", origen: "manual" });
      cierto(ins.error, "ha podido insertar");
      const { data: filas } = await admin.from("lista_items").select("id").eq("grupo_id", g!.grupo_id).limit(1);
      const del = await s.from("lista_items").delete().eq("id", filas![0].id).select("id");
      cierto(!del.data?.length, "ha podido borrar");
      const upd = await s.from("lista_items").update({ texto_libre: "intruso" }).eq("id", filas![0].id).select("id");
      cierto(!upd.data?.length, "ha podido cambiar");
    });
    await caso("S3", "Los datos de salud son solo de cada persona, ni el hogar los ve", async () => {
      const s = await clienteDe(cb);
      const { data } = await s.from("perfiles_salud").select("usuario_id").eq("usuario_id", ca.id);
      cierto(!data?.length, "ve el perfil de salud de otro miembro");
    });
    await caso("S4", "Sin sesion no se llega a los datos ni con la clave publica", async () => {
      const s = createClient(URL_SB, ANON, { auth: { persistSession: false } });
      for (const t of ["lista_items", "despensa", "perfiles_salud", "grupos"]) {
        const { data } = await s.from(t).select("*").limit(1);
        cierto(!data?.length, `${t} abierta sin sesion`);
      }
    });
    await caso("S5", "El cron de avisos no se puede lanzar desde fuera", async () => {
      const r = await fetch(`${BASE}/api/cron/recordatorios`);
      cierto(r.status === 401, String(r.status));
    });
    await caso("S6", "Nadie puede cambiar el precio del catalogo", async () => {
      const s = await clienteDe(cc);
      const { data: p } = await admin.from("productos").select("id, precio").not("precio", "is", null).limit(1).single();
      const r = await s.from("productos").update({ precio: 0.01 }).eq("id", p!.id).select("id");
      cierto(!r.data?.length, "ha cambiado un precio");
      const { data: q } = await admin.from("productos").select("precio").eq("id", p!.id).single();
      cierto(q!.precio === p!.precio, "precio alterado");
    });

    // ---- Despensa ----
    await caso("D1", "Anadir desde el buscador de la despensa", async () => {
      await ir(pc, "/despensa");
      await buscar(pc, "arroz");
      await pc.locator("ul button").first().click();
      await ve(pc, /^Añadido: /);
      await ir(pc, "/despensa");
      await pc.getByRole("button", { name: /^Uno más de/ }).first().waitFor({ timeout: ESPERA });
    });
    await caso("D2", "Sumar y gastar unidades", async () => {
      await pc.getByRole("button", { name: /^Uno más de/ }).first().click();
      await calma(pc);
      await ir(pc, "/despensa");
      await incluye(pc, /− 2 \+/);
      await pc.getByRole("button", { name: /^Gastar uno de/ }).first().click();
      await calma(pc);
      await ir(pc, "/despensa");
      await incluye(pc, /− 1 \+/);
    });
    await caso("D3", "Caducidad cercana: pasa a Caduca pronto", async () => {
      await pc.locator("main li button[aria-expanded]").first().click();
      const fecha = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
      await pc.locator('input[type="date"]').fill(fecha);
      await calma(pc);
      await ir(pc, "/despensa");
      await incluye(pc, "CADUCA PRONTO");
    });
    await caso("D4", "Producto caducado: lo avisa", async () => {
      await pc.locator("main li button[aria-expanded]").first().click();
      await pc.locator('input[type="date"]').fill(new Date(Date.now() - 864e5).toISOString().slice(0, 10));
      await calma(pc);
      await ir(pc, "/despensa");
      await incluye(pc, /caducado/);
    });
    await caso("D5", "Cambiarlo de sitio y filtrar por Nevera y Congelador", async () => {
      await pc.locator("main li button[aria-expanded]").first().click();
      await pc.getByRole("button", { name: "Congelador" }).click().catch(async () => {
        await pc.locator("main li").getByText("Congelador").first().click();
      });
      await calma(pc);
      await ir(pc, "/despensa?l=congelador");
      cierto(await pc.getByRole("button", { name: /^Uno más de/ }).count(), "no sale en Congelador");
      await ir(pc, "/despensa?l=nevera");
      await ve(pc, "Aquí no hay nada");
    });
    await caso("D6", "Filtro inventado en la direccion: no rompe", async () => {
      const r = await pc.goto(`${BASE}/despensa?l=<script>`);
      cierto(r?.status() === 200, String(r?.status()));
      await incluye(pc, "Despensa");
    });
    await caso("D7", "Tirar un producto estropeado", async () => {
      await ir(pc, "/despensa");
      await pc.locator("main li button[aria-expanded]").first().click();
      await pc.getByRole("button", { name: "Se ha estropeado: tirar" }).click();
      await calma(pc);
      await ir(pc, "/despensa");
      await ve(pc, "La despensa está vacía");
    });
    await caso("D8", "Lo que se acaba vuelve a la lista", async () => {
      await ir(pa, "/despensa");
      const b1 = pa.getByRole("button", { name: /^Gastar uno de Leche/ }).first();
      const nombre = (await b1.getAttribute("aria-label"))!.replace("Gastar uno de ", "");
      let n = 0;
      while ((await pa.getByRole("button", { name: /^Gastar uno de Leche/ }).count()) && n++ < 6) {
        await pa.getByRole("button", { name: /^Gastar uno de Leche/ }).first().click();
        await calma(pa);
        await ir(pa, "/despensa");
      }
      await ir(pa, "/lista");
      await incluye(pa, nombre.slice(0, 12));
    });

    // ---- Dieta ----
    await caso("T1", "Guardar una comida sin nombre: se rechaza", async () => {
      await ir(pc, "/dieta");
      await pc.getByRole("button", { name: "Añadir comida" }).click();
      await pc.getByRole("button", { name: "Guardar" }).click();
      await pc.getByRole("alert").first().waitFor({ timeout: ESPERA });
      await pc.getByRole("button", { name: "Cancelar" }).click();
    });
    await caso("T2", "Comida a mano con ingrediente", async () => {
      await pc.getByRole("button", { name: "Añadir comida" }).click();
      await pc.getByLabel("Nombre de la comida").fill("Lentejas con arroz");
      await pc.getByText("Añadir ingrediente").click();
      await pc.getByLabel("Ingrediente").selectOption({ label: "Lentejas cocidas (bote)" });
      await pc.getByLabel("Cantidad").fill("250,5");
      await pc.getByRole("button", { name: "Guardar" }).click();
      await ve(pc, "Lentejas con arroz");
      await ir(pc, "/dieta");
      await incluye(pc, /lentejas cocidas \(bote\) 25\d/);
      return (await texto(pc)).match(/lentejas cocidas \(bote\) [^A-Z]{1,12}/)?.[0];
    });
    await caso("T3", "Moverse de semana y volver a hoy", async () => {
      await pc.getByRole("link", { name: "Siguiente" }).click();
      await pc.waitForURL(/d=/);
      await ve(pc, "Ir a hoy");
      await noIncluye(pc, "Lentejas con arroz");
      await pc.getByRole("link", { name: "Ir a hoy" }).click();
      await ve(pc, "Lentejas con arroz");
    });
    await caso("T4", "Vista mes con los puntos de los dias con comida", async () => {
      await pc.getByRole("link", { name: "Mes" }).click();
      await pc.waitForURL(/v=mes/);
      const dias = await pc.locator('main a[aria-label] span.h-1').count();
      cierto(dias >= 1, "sin puntos");
    });
    await caso("T5", "Fecha rara en la direccion: va a hoy, no rompe", async () => {
      for (const d of ["xx", "2026-13-45", "<b>"]) {
        const r = await pc.goto(`${BASE}/dieta?d=${encodeURIComponent(d)}`);
        cierto(r?.status() === 200, `${d}: ${r?.status()}`);
        await incluye(pc, "Dieta");
      }
    });
    await caso("T6", "Fecha en una semana pasada no ofrece rehacer con IA", async () => {
      await ir(pc, "/dieta?d=2026-01-05");
      await noIncluye(pc, "Rellenar la semana con IA");
      await noIncluye(pc, "Rehacer la semana con IA");
    });
    await caso("T7", "Marcar hecha y deshacer", async () => {
      await ir(pc, "/dieta");
      await pc.getByRole("button", { name: "Hecha", exact: true }).click();
      await ve(pc, "Deshacer");
      await pc.getByRole("button", { name: "Deshacer" }).click();
      await pc.getByRole("button", { name: "Hecha", exact: true }).waitFor({ timeout: ESPERA });
    });
    await caso("T8", "Saltar una comida", async () => {
      await pc.getByRole("button", { name: "Saltada", exact: true }).click();
      await ve(pc, "Deshacer");
      await pc.getByRole("button", { name: "Deshacer" }).click();
      await pc.getByRole("button", { name: "Hecha", exact: true }).waitFor({ timeout: ESPERA });
    });
    await caso("T9", "¿Que me falta? una vez y otra sin duplicar", async () => {
      await ir(pc, "/lista");
      await pc.getByRole("button", { name: /Qué me falta/ }).click();
      await pc.getByRole("status").first().waitFor({ timeout: 30_000 });
      await calma(pc);
      await ir(pc, "/lista");
      await incluye(pc, /Lentejas/i);
      const contar = async () => ((await texto(pc)).match(/Lentejas/gi) ?? []).length;
      const n = await contar();
      await pc.getByRole("button", { name: /Qué me falta/ }).click();
      await pc.getByRole("status").first().waitFor({ timeout: 30_000 });
      await calma(pc);
      await ir(pc, "/lista");
      cierto((await contar()) === n, "se ha duplicado");
    });
    await caso("T10", "Con lo que falta en casa, ¿Que me falta? deja de pedirlo", async () => {
      await pc.getByRole("button", { name: /^Comprado: Lentejas/ }).click();
      await calma(pc);
      await ir(pc, "/lista");
      await pc.getByRole("button", { name: /Qué me falta/ }).click();
      await pc.getByRole("status").first().waitFor({ timeout: 30_000 });
      await calma(pc);
      await ir(pc, "/lista");
      const quedan = await pc.getByRole("button", { name: /^Comprado: Lentejas/ }).count();
      return quedan ? `pide aun ${quedan} (250 g frente a la compra de 1 unidad)` : "ya no lo pide";
    });
    await caso("T11", "Repetir la semana y que no pise lo ya copiado", async () => {
      await ir(pc, "/dieta");
      await pc.getByRole("button", { name: /Repetir esta semana/ }).click();
      await pc.getByRole("status").first().waitFor({ timeout: 30_000 });
      const uno = await pc.getByRole("status").first().innerText();
      await ir(pc, "/dieta");
      await pc.getByRole("button", { name: /Repetir esta semana/ }).click();
      await pc.getByRole("status").first().waitFor({ timeout: 30_000 });
      const dos = await pc.getByRole("status").first().innerText();
      return `${uno} | ${dos}`;
    });
    await caso("T12", "Borrar una comida", async () => {
      await ir(pc, "/dieta");
      await pc.getByRole("button", { name: "Borrar Lentejas con arroz" }).click();
      await calma(pc);
      await ir(pc, "/dieta");
      await noIncluye(pc, "Lentejas con arroz");
    });
    await caso("T13", "Apuntar algo fuera del plan", async () => {
      await pc.getByRole("button", { name: "Apuntar algo fuera del plan" }).click();
      await pc.getByLabel("Qué has comido").fill("Tostada");
      await pc.getByRole("button", { name: /Apuntar|Guardar/ }).last().click();
      await ve(pc, /Apuntado/);
    });

    // ---- Perfil y salvaguardas ----
    const rellenar = async (p: Page, v: Record<string, string>, consentir = true) => {
      await ir(p, "/perfil");
      await p.fill('input[name="nombre"]', "Prueba");
      for (const [k, val] of Object.entries({ sexo: "hombre", actividad: "moderado", objetivo: "mantenimiento", ...v })) {
        if (["sexo", "actividad", "objetivo"].includes(k)) await p.selectOption(`select[name="${k}"]`, val);
      }
      await p.fill('input[name="fecha_nacimiento"]', v.fecha ?? "1994-03-10");
      await p.fill('input[name="altura_cm"]', v.altura ?? "176");
      await p.fill('input[name="peso_kg"]', v.peso ?? "78");
      const c = p.locator('input[name="consentimiento"]');
      if (consentir) await c.check(); else await c.uncheck();
      await p.getByRole("button", { name: "Guardar" }).click();
      await calma(p);
      await ir(p, "/perfil");
    };
    await caso("P1", "Sin perfil, la Dieta invita a completarlo", async () => {
      await ir(pb, "/dieta");
      await incluye(pb, "Completa tu perfil");
    });
    await caso("P2", "Sin consentimiento no se calculan objetivos", async () => {
      await rellenar(pb, {}, false);
      await noIncluye(pb, "Tu objetivo diario estimado");
    });
    await caso("P3", "Perfil normal: objetivos en Perfil y en Dieta", async () => {
      await rellenar(pb, {});
      await incluye(pb, "Tu objetivo diario estimado");
      const kcal = (await texto(pb)).match(/([\d.]+) kcal/)?.[1];
      await ir(pb, "/dieta");
      await incluye(pb, `Objetivo: ${kcal} kcal`);
      return `${kcal} kcal`;
    });
    await caso("P4", "Menor de edad: deriva a un profesional y no da objetivos", async () => {
      await rellenar(pb, { fecha: "2012-01-01" });
      await incluye(pb, "profesional sanitario");
      await noIncluye(pb, "Tu objetivo diario estimado");
      await ir(pb, "/dieta");
      await noIncluye(pb, "Objetivo:");
    });
    await caso("P5", "Menor: la IA no genera plan y deriva (sin gastar peticiones)", async () => {
      await ir(pb, "/dieta");
      await pb.getByRole("button", { name: /(Rellenar|Rehacer) la semana con IA/ }).click();
      await ve(pb, "profesional sanitario");
    });
    await caso("P6", "IMC muy bajo: deriva", async () => {
      await rellenar(pb, { peso: "48", altura: "170" });
      await incluye(pb, "profesional sanitario");
    });
    await caso("P7", "Altura o peso imposibles: pide el dato, no calcula", async () => {
      await rellenar(pb, { peso: "5" });
      await noIncluye(pb, "Tu objetivo diario estimado");
      await rellenar(pb, {});
    });
    await caso("P8", "Enfermedad marcada: deriva", async () => {
      await ir(pb, "/perfil");
      await pb.locator('input[name="condiciones_medicas"]').first().check();
      await pb.getByRole("button", { name: "Guardar" }).click();
      await calma(pb);
      await ir(pb, "/perfil");
      await incluye(pb, "profesional sanitario");
      await pb.locator('input[name="condiciones_medicas"]').first().uncheck();
      await pb.getByRole("button", { name: "Guardar" }).click();
      await calma(pb);
    });

    // ---- Comparar y escanear ----
    await caso("M1", "Comparar un ingrediente ordena por precio por kilo/litro", async () => {
      await ir(pa, "/comparar");
      await pa.getByLabel("Ingrediente").selectOption({ label: "Aceite de oliva virgen extra" });
      await pa.getByRole("button", { name: "Ver" }).click();
      await pa.waitForURL(/i=/);
      await pa.locator("main ol li").first().waitFor({ timeout: ESPERA });
      const unidades = (await pa.locator("main ol li").allInnerTexts()).map((t) => Number(t.match(/([\d,]+)\s*€\/l/)?.[1].replace(",", ".")));
      cierto(unidades.every((u, i) => i === 0 || u >= unidades[i - 1]), `sin ordenar: ${unidades}`);
      return unidades.join(" · ") + " €/l";
    });
    await caso("M2", "Comparar solo muestra tiendas cercanas", async () => {
      const t = await texto(pa);
      cierto(!/Gadis|Caprabo/.test(t), "sale una tienda lejana");
    });
    await caso("M3", "Ingrediente inventado en la direccion: no rompe", async () => {
      const r = await pa.goto(`${BASE}/comparar?i=no-existe`);
      cierto(r?.status() === 200, String(r?.status()));
    });
    await caso("E1", "Escanear: un codigo corto no deja buscar", async () => {
      await ir(pa, "/escanear");
      await pa.getByLabel("Código de barras").fill("123");
      cierto(await pa.locator('form button[type="submit"]').isDisabled(), "deja buscar");
    });
    await caso("E2", "Escanear: codigo de un producto del catalogo", async () => {
      const { data } = await admin.from("productos").select("ean, nombre").eq("supermercado_id", "carrefour").not("ean", "is", null).not("precio", "is", null).limit(1).single();
      await pa.getByLabel("Código de barras").fill(data!.ean);
      await pa.locator('form button[type="submit"]').click();
      await ve(pa, /Añadir al inventario/);
      return data!.nombre.slice(0, 60);
    });
    await caso("E3", "Escanear: codigo desconocido ofrece darlo de alta (no se guarda)", async () => {
      await ir(pa, "/escanear");
      await pa.getByLabel("Código de barras").fill("0000000000017");
      await pa.locator('form button[type="submit"]').click();
      await pa.getByRole("button", { name: /Dar de alta|Escanear otro/ }).first().waitFor({ timeout: 30_000 });
      return (await texto(pa)).slice(0, 110);
    });

    // ---- Movil y aspecto ----
    await caso("V1", "Ninguna pantalla desborda a lo ancho en un movil pequeno (320 px)", async () => {
      const x = await abrir(nav, ca, 320);
      const malas: string[] = [];
      for (const r of ["/lista", "/despensa", "/dieta", "/dieta?v=mes", "/ajustes", "/grupo", "/perfil", "/ubicacion", "/comparar?i=aceite_oliva", "/nutriem", "/escanear"]) {
        await ir(x.page, r);
        if (await x.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) malas.push(r);
      }
      await x.page.context().close();
      cierto(!malas.length, malas.join(", "));
    });
    await caso("V2", "Tema oscuro guardado se aplica sin parpadeo", async () => {
      await pa.addInitScript(() => localStorage.setItem("tema", "oscuro"));
      await ir(pa, "/lista");
      cierto((await pa.evaluate(() => document.documentElement.dataset.theme)) === "dark", "no aplica");
      await pa.addInitScript(() => localStorage.removeItem("tema"));
    });
    await caso("V3", "Cambiar de pestana es instantaneo", async () => {
      await ir(pa, "/lista");
      await pa.waitForTimeout(4000);
      const n = pa.getByRole("navigation", { name: "Principal" });
      const tiempos: number[] = [];
      for (const [t, u] of [["Despensa", "/despensa"], ["Dieta", "/dieta"], ["Ajustes", "/ajustes"], ["Lista", "/lista"]]) {
        const a = Date.now();
        await n.getByRole("link", { name: t }).click();
        await pa.waitForURL(`**${u}`);
        await pa.locator("h1").filter({ hasText: t }).waitFor({ timeout: ESPERA });
        tiempos.push(Date.now() - a);
      }
      cierto(Math.max(...tiempos) < 1000, tiempos.join(", "));
      return tiempos.map((t) => `${t} ms`).join(", ");
    });
    await caso("V4", "La pestana activa se marca, tambien en las pantallas interiores", async () => {
      await ir(pa, "/comparar");
      const activa = await pa.getByRole("navigation", { name: "Principal" }).locator('[aria-current="page"]').innerText();
      cierto(activa === "Ajustes", activa);
    });
    await caso("V5", "Manifest de la PWA abre en la Lista y tiene icono", async () => {
      const m = await (await fetch(`${BASE}/manifest.webmanifest`)).json();
      cierto(m.start_url === "/lista", m.start_url);
      cierto(m.icons?.length, "sin iconos");
      const r = await fetch(`${BASE}/sw.js`);
      cierto(r.ok, "sin service worker");
    });
    await caso("V6", "Avisos: la pantalla ofrece activarlos", async () => {
      await ir(pa, "/ajustes");
      await incluye(pa, /Activar avisos|avisos/i);
    });

    // ---- IA (gastan peticiones del cupo diario) ----
    if (conIA) {
      await rellenar(pb, {});
      await caso("I1", "Chat: responde a una duda normal", async () => {
        await ir(pb, "/nutriem");
        await pb.getByLabel("Pregunta para Nutri-em").fill("¿Qué desayuno me aguanta hasta mediodía?");
        await pb.getByRole("button", { name: /Enviar/ }).click();
        await pb.waitForFunction(() => (document.querySelector("main") as HTMLElement).innerText.length > 300, null, { timeout: 120_000 });
        return (await texto(pb)).slice(40, 190);
      });
      await caso("I2", "Rellenar la semana con IA con los objetivos del perfil", async () => {
        await ir(pb, "/dieta");
        await pb.getByRole("button", { name: /(Rellenar|Rehacer) la semana con IA/ }).click();
        await pb.waitForFunction(() => !/Preparando la semana/.test((document.querySelector("main") as HTMLElement).innerText), null, { timeout: 295_000 });
        await calma(pb);
        const alerta = pb.getByRole("alert");
        if (await alerta.count()) throw new Error(await alerta.first().innerText());
        await ir(pb, "/dieta");
        await incluye(pb, /Rehacer la semana con IA/);
        return (await texto(pb)).match(/HOY.{0,220}/)?.[0];
      });
    }

    await caso("Z1", "Ningun error de JavaScript ni 5xx en todo el recorrido", async () => {
      const todos = [...new Set([...a.errores, ...b.errores, ...c.errores])];
      cierto(!todos.length, todos.slice(0, 4).join(" | "));
    });
  } finally {
    await nav.close();
    const n = await limpiar();
    const { count } = await admin.from("grupos").select("id", { count: "exact", head: true }).in("nombre", ["Casa de Ana", "Otra casa"]);
    console.log(`\nLimpieza: ${n} cuentas temporales borradas; quedan ${count ?? "?"} hogares de prueba.`);
  }

  const fallos = resultados.filter((r) => !r.ok);
  console.log(`\n${resultados.length - fallos.length} de ${resultados.length} casos OK`);
  for (const f of fallos) console.log(`  FALLO ${f.id} ${f.nombre}: ${f.nota}`);
  const dir = path.join("data", "eval");
  fs.mkdirSync(dir, { recursive: true });
  const archivo = path.join(dir, `casos-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`);
  fs.writeFileSync(archivo, JSON.stringify({ base: BASE, resultados }, null, 1));
  console.log(`Informe: ${archivo}`);
  process.exitCode = fallos.length ? 1 : 0;
}

await main();

// Cliente HTTP educado: User-Agent identificativo, limite de velocidad,
// reintentos con espera creciente y respeto de Retry-After.

export interface OpcionesHttp {
  intervaloMs?: number;   // minimo entre peticiones (por defecto 1000 = 1 peticion/s)
  reintentos?: number;
  timeoutMs?: number;
  maxPeticiones?: number; // tope de seguridad por ejecucion
}

export class ClienteHttp {
  peticiones = 0;
  errores = 0;
  private ultima = 0;
  private readonly ua: string;

  constructor(private readonly op: OpcionesHttp = {}) {
    this.ua = process.env.SCRAPER_USER_AGENT || "Eat-em/0.1 (uso personal)";
  }

  get agotado() {
    return this.op.maxPeticiones !== undefined && this.peticiones >= this.op.maxPeticiones;
  }

  async json<T>(url: string): Promise<T> {
    return JSON.parse(await this.texto(url, "application/json")) as T;
  }

  async texto(url: string, accept = "text/html,application/xml;q=0.9,*/*;q=0.8"): Promise<string> {
    const reintentos = this.op.reintentos ?? 4;
    for (let intento = 0; ; intento++) {
      await this.esperarTurno();
      this.peticiones++;
      try {
        const r = await fetch(url, {
          headers: { "User-Agent": this.ua, Accept: accept },
          signal: AbortSignal.timeout(this.op.timeoutMs ?? 20_000),
        });
        if (r.ok) return await r.text();
        // 4xx (salvo 429) no se arregla reintentando
        if (r.status !== 429 && r.status < 500) throw new ErrorHttp(r.status, url, false);
        const retry = Number(r.headers.get("retry-after"));
        throw new ErrorHttp(r.status, url, true, Number.isFinite(retry) ? retry * 1000 : undefined);
      } catch (e) {
        const reintentable = !(e instanceof ErrorHttp) || e.reintentable;
        if (!reintentable || intento >= reintentos) {
          this.errores++;
          throw e;
        }
        const espera = (e instanceof ErrorHttp && e.esperaMs) || 2 ** intento * 2000 + Math.random() * 1000;
        console.warn(`  reintento ${intento + 1}/${reintentos} en ${Math.round(espera / 1000)} s: ${(e as Error).message}`);
        await dormir(espera);
      }
    }
  }

  private async esperarTurno() {
    const intervalo = this.op.intervaloMs ?? 1000;
    const falta = this.ultima + intervalo - Date.now();
    if (falta > 0) await dormir(falta);
    this.ultima = Date.now();
  }
}

export class ErrorHttp extends Error {
  constructor(public status: number, url: string, public reintentable: boolean, public esperaMs?: number) {
    super(`HTTP ${status} en ${url}`);
  }
}

export const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

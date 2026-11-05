import Link from "next/link";
import { Pantalla, Vacio } from "./ui";

export default function NoEncontrada() {
  return (
    <Pantalla className="pt-16">
      <Vacio titulo="Esta página no existe" texto="Puede que el enlace sea antiguo o esté mal escrito." />
      <Link href="/lista" className="mt-3 block w-full rounded-xl bg-marca py-3 text-center font-semibold text-marca-texto">Ir a la lista</Link>
    </Pantalla>
  );
}

import { redirect } from "next/navigation";

// El dia de hoy esta arriba del todo en Dieta
export default function Hoy() {
  redirect("/dieta");
}

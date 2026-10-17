import { redirect } from "next/navigation";

// La despensa por producto sustituye al inventario por ingrediente
export default function Inventario() {
  redirect("/despensa");
}

import { redirect } from "next/navigation";

// La app abre en la lista de la compra
export default function Inicio() {
  redirect("/lista");
}

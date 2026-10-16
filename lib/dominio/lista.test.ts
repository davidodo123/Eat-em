import { test } from "node:test";
import assert from "node:assert/strict";
import { listaParaWhatsapp } from "./lista.ts";

test("lista para WhatsApp", () => {
  const texto = listaParaWhatsapp("Lista de Casa", [
    { nombre: "Pilas AA" },
    { nombre: "Yogur natural", detalle: "2 paquetes", categoria: "Lacteos" },
    { nombre: "Leche semidesnatada", detalle: "6 l", categoria: "Lacteos", urgente: true },
    { nombre: "Platano", categoria: "Fruta" },
  ]);
  assert.equal(texto, [
    "*Lista de Casa*",
    "", "_Fruta_", "- Platano",
    "", "_Lacteos_", "- ❗ Leche semidesnatada (6 l)", "- Yogur natural (2 paquetes)",
    "", "_Otros_", "- Pilas AA",
  ].join("\n"));
});

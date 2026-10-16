// Validacion de codigos EAN-8 / EAN-13 (digito de control GS1).
// Pesos 3 y 1 alternos empezando por la derecha, sin contar el digito de control.

export function eanValido(codigo: string | null | undefined): boolean {
  if (!codigo || !/^(\d{8}|\d{13})$/.test(codigo)) return false;
  if (/^0+$/.test(codigo)) return false;
  const digitos = codigo.split("").map(Number);
  const control = digitos.pop()!;
  let suma = 0;
  for (let i = digitos.length - 1, peso = 3; i >= 0; i--, peso = peso === 3 ? 1 : 3) {
    suma += digitos[i] * peso;
  }
  return (10 - (suma % 10)) % 10 === control;
}

// Devuelve el EAN limpio si es valido; si no, null
export function normalizarEan(codigo: string | null | undefined): string | null {
  const limpio = (codigo ?? "").replace(/\D/g, "");
  return eanValido(limpio) ? limpio : null;
}

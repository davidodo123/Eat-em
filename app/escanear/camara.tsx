"use client";
import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";

// Lector de codigos de barras con la camara trasera. zxing funciona tambien en iOS
// (BarcodeDetector no existe en Safari). Solo EAN/UPC: mas rapido y menos falsos positivos.
export function Camara({ onCodigo }: { onCodigo: (codigo: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const aviso = useRef(onCodigo);
  aviso.current = onCodigo;

  useEffect(() => {
    let controles: IScannerControls | undefined;
    let cancelado = false;
    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"), import("@zxing/library"),
        ]);
        const pistas = new Map([[DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
        ]]]);
        const lector = new BrowserMultiFormatReader(pistas, { delayBetweenScanAttempts: 150 });
        if (cancelado || !video.current) return;
        controles = await lector.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false }, video.current,
          (resultado, _err, c) => {
            if (!resultado) return;
            c.stop();
            navigator.vibrate?.(60);
            aviso.current(resultado.getText());
          },
        );
        if (cancelado) controles.stop();
      } catch (e) {
        const nombre = (e as Error).name;
        setError(nombre === "NotAllowedError"
          ? "Sin permiso para usar la cámara. Actívalo en los ajustes del navegador o escribe el código."
          : "No se pudo abrir la cámara. Escribe el código a mano.");
      }
    })();
    return () => { cancelado = true; controles?.stop(); };
  }, []);

  if (error) return <p className="caja p-4 text-sm text-texto-suave" role="alert">{error}</p>;
  return (
    <div className="relative overflow-hidden rounded-xl border border-borde bg-black">
      <video ref={video} className="aspect-[4/3] w-full object-cover" muted playsInline />
      <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-marca/80" />
    </div>
  );
}

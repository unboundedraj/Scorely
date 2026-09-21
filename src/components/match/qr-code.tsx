"use client";

import QRCode from "qrcode";
import { useMemo } from "react";

/** Renders a QR code as inline SVG (computed synchronously, no canvas). */
export function QrCode({ value, className, label }: { value: string; className?: string; label?: string }) {
  const path = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
    const size = qr.modules.size;
    let d = "";
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (qr.modules.get(y, x)) d += `M${x} ${y}h1v1h-1z`;
      }
    }
    return { d, size };
  }, [value]);

  const pad = 2;
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${path.size + pad * 2} ${path.size + pad * 2}`}
      className={className}
      role="img"
      aria-label={label ?? `QR code for ${value}`}
      shapeRendering="crispEdges"
    >
      <rect x={-pad} y={-pad} width={path.size + pad * 2} height={path.size + pad * 2} fill="#fff" />
      <path d={path.d} fill="#0b1220" />
    </svg>
  );
}

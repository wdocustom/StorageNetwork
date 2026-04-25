export async function captureCanvasBlob(
  selector = "canvas",
  quality = 0.92,
): Promise<Blob | null> {
  const canvas = document.querySelector<HTMLCanvasElement>(selector);
  if (!canvas) return null;

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob),
      "image/jpeg",
      quality,
    );
  });
}

export function captureCanvasDataUrl(
  selector = "canvas",
  quality = 0.92,
): string | null {
  const canvas = document.querySelector<HTMLCanvasElement>(selector);
  if (!canvas) return null;
  return canvas.toDataURL("image/jpeg", quality);
}

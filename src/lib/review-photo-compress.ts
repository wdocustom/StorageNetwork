// Browser only: resize a phone photo to a JPEG (longest side ≤ 1600px) so
// review photos upload fast and stay small. EXIF orientation is applied by
// the browser when drawing (image-orientation: from-image is the default).

const MAX_SIDE = 1600;
const QUALITY = 0.82;

export async function compressReviewPhoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("We couldn't open that photo. Try a JPEG or PNG."));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("We couldn't process that photo.");
    ctx.fillStyle = "#fff"; // transparent PNGs → white, not black
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("We couldn't process that photo."))), "image/jpeg", QUALITY),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

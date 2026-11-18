// The Storage Network wordmark as an RGBA PNG data URL, for PDF covers (the
// tote plans and the ladder jig). Browser only; resolves undefined when the
// image can't load, and the PDFs fall back to a text mark.
export function loadCoverLogo(): Promise<string | undefined> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(undefined);
      }
    };
    img.onerror = () => resolve(undefined);
    img.src = "/brand-wordmark.png";
  });
}

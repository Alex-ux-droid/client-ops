"use client";
// Файли для Джері: картинки стискаємо в браузері (до 1600px, JPEG), PDF і текст — як є. Віддаємо base64.
export type ChatFile = { name: string; type: string; data: string; preview?: string; size: number };
const MAX = 10 * 1024 * 1024;

const toB64 = (buf: ArrayBuffer) => { let s = ""; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };

async function shrink(file: File): Promise<{ type: string; data: string; preview: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    if (k === 1 && file.size < 1_500_000 && file.type !== "image/heic") {
      const data = toB64(await file.arrayBuffer());
      return { type: file.type, data, preview: `data:${file.type};base64,${data}` };
    }
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const du = c.toDataURL("image/jpeg", 0.86);
    return { type: "image/jpeg", data: du.split(",")[1], preview: du };
  } finally { URL.revokeObjectURL(url); }
}

export async function readChatFile(file: File): Promise<ChatFile> {
  if (file.size > MAX && !file.type.startsWith("image/")) throw new Error(`«${file.name}» завеликий (до 10 МБ)`);
  if (file.type.startsWith("image/")) {
    const s = await shrink(file);
    return { name: file.name || "фото.jpg", type: s.type, data: s.data, preview: s.preview, size: Math.round(s.data.length * 0.75) };
  }
  if (file.type === "application/pdf" || /^text\/|json|csv/.test(file.type) || /\.(txt|md|csv|json)$/i.test(file.name)) {
    return { name: file.name, type: file.type === "application/pdf" ? "application/pdf" : "text/plain", data: toB64(await file.arrayBuffer()), size: file.size };
  }
  throw new Error(`«${file.name}» — такий тип я не прочитаю (фото, PDF або текст)`);
}

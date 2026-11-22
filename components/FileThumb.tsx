"use client";
import { useState } from "react";

// Прев'ю файлу: картинка з Диску, а якщо прев'ю нема — плашка типу файлу (PDF, Excel, Numbers, Word…)
const TYPES: [RegExp, string, string][] = [
  [/\.pdf$/i, "PDF", "pdf"], [/\.(xlsx?|csv)$/i, "XLS", "sheet"], [/\.numbers$/i, "NUMBERS", "sheet"],
  [/\.(docx?|rtf)$/i, "DOC", "doc"], [/\.pages$/i, "PAGES", "doc"], [/\.(pptx?|key)$/i, "SLIDES", "slides"],
  [/\.(svg|ai|eps)$/i, "VECTOR", "vector"], [/\.(mp4|mov|webm)$/i, "VIDEO", "video"], [/\.(zip|rar)$/i, "ZIP", "other"],
];
export function fileType(name: string, mime: string): [string, string] {
  for (const [re, label, cls] of TYPES) if (re.test(name)) return [label, cls];
  if (mime.includes("spreadsheet")) return ["XLS", "sheet"];
  if (mime.includes("presentation")) return ["SLIDES", "slides"];
  if (mime.includes("document") || mime.includes("word")) return ["DOC", "doc"];
  if (mime === "application/pdf") return ["PDF", "pdf"];
  return [(name.split(".").pop() ?? "FILE").toUpperCase().slice(0, 7), "other"];
}

export default function FileThumb({ src, name, mime }: { src: string; name: string; mime: string }) {
  const [failed, setFailed] = useState(false);
  const [label, cls] = fileType(name, mime);
  // плашку видно, тільки якщо прев'ю не завантажилось (CSS: img + .ft-badge прихована)
  return (
    <span className={`ft ft-${cls}`}>
      {!failed && <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />}
      <span className="ft-badge"><b>{label}</b></span>
    </span>
  );
}

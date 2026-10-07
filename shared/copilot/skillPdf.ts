import { PDFDocument, StandardFonts } from "pdf-lib";

export async function reportPdf(title: string, lines: string[]): Promise<{ filename: string; bytes: Uint8Array; plain: string }> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  const safe = (line: string) => line.replace(/[^\x20-\x7E]/g, " ").slice(0, 90);
  let y = 740;
  page.drawText(safe(title) || "Report", { x: 50, y, size: 16, font });
  y -= 28;
  for (const line of lines) {
    if (y < 72) break;
    page.drawText(safe(line), { x: 50, y, size: 12, font });
    y -= 18;
  }
  const bytes = await doc.save();
  return { filename: "guest-product.pdf", bytes, plain: [title, ...lines].join("\n") };
}

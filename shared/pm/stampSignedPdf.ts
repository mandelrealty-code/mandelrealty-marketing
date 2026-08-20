import { PDFDocument, StandardFonts, rgb, LineCapStyle } from "pdf-lib";
import { isCheckboxChecked, type SignField } from "./signFields.js";

function decodePngDataUrl(raw: string | undefined | null): Buffer | null {
  if (!raw?.trim()) return null;
  try {
    const b64 = raw.trim().replace(/^data:image\/\w+;base64,/, "");
    const buf = Buffer.from(b64, "base64");
    return buf.length > 20 ? buf : null;
  } catch {
    return null;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function textForField(
  field: SignField,
  fallbacks: { signerName: string; signedOnLabel: string },
): string {
  if (field.value?.trim()) return field.value.trim();
  if (field.type === "date") return fallbacks.signedOnLabel;
  if (field.type === "checkbox") return "";
  if (field.type === "name" || field.type === "text" || field.type === "signature") {
    return fallbacks.signerName.trim();
  }
  return "";
}

export async function stampSignedPdf(input: {
  pdfBuffer: Buffer;
  fields: SignField[];
  signerName?: string;
  signedOnLabel?: string;
  signaturePng?: Buffer | null;
}): Promise<Buffer> {
  const doc = await PDFDocument.load(input.pdfBuffer);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const fallbacks = {
    signerName: input.signerName || "",
    signedOnLabel: input.signedOnLabel || "",
  };

  const embedPng = async (png: Buffer | null) => {
    if (!png || png.length < 20) return null;
    try {
      return await doc.embedPng(png);
    } catch {
      return null;
    }
  };

  let sharedSignature = await embedPng(input.signaturePng ?? null);
  const gold = rgb(0.12, 0.12, 0.12);

  for (const field of input.fields) {
    const page = doc.getPage(field.page - 1);
    if (!page) continue;
    const { width, height } = page.getSize();
    const x = clamp(field.x, 0, 1) * width;
    const minFrac = field.type === "checkbox" ? 0.008 : 0.008;
    const boxH = clamp(field.h, minFrac, 1) * height;
    const boxW = clamp(field.w, field.type === "checkbox" ? 0.008 : 0.02, 1) * width;
    const y = height - clamp(field.y, 0, 1) * height - boxH;

    if (field.type === "checkbox") {
      const size = Math.min(boxW, boxH);
      const ox = x + (boxW - size) / 2;
      const oy = y + (boxH - size) / 2;
      const stroke = Math.max(0.7, size * 0.08);
      page.drawRectangle({
        x: ox,
        y: oy,
        width: size,
        height: size,
        borderColor: gold,
        borderWidth: stroke,
      });
      if (isCheckboxChecked(field.value)) {
        const t = Math.max(1.1, size * 0.12);
        page.drawLine({
          start: { x: ox + size * 0.18, y: oy + size * 0.48 },
          end: { x: ox + size * 0.42, y: oy + size * 0.22 },
          thickness: t,
          color: gold,
          lineCap: LineCapStyle.Round,
        });
        page.drawLine({
          start: { x: ox + size * 0.4, y: oy + size * 0.24 },
          end: { x: ox + size * 0.84, y: oy + size * 0.78 },
          thickness: t,
          color: gold,
          lineCap: LineCapStyle.Round,
        });
      }
      continue;
    }

    if (field.type === "signature") {
      const own = await embedPng(decodePngDataUrl(field.signature_png));
      const image = own || (field.party === "mrg" ? null : sharedSignature);
      if (image) {
        const scale = Math.min(boxW / image.width, boxH / image.height);
        const drawW = image.width * scale;
        const drawH = image.height * scale;
        page.drawImage(image, {
          x: x + (boxW - drawW) / 2,
          y: y + (boxH - drawH) / 2,
          width: drawW,
          height: drawH,
        });
        continue;
      }
    }

    const text = textForField(field, fallbacks);
    if (!text) continue;
    const useFont = field.type === "signature" ? italic : font;
    let size =
      field.type === "signature" ? Math.min(16, boxH * 0.72) : Math.min(10, boxH * 0.78);
    while (size > 4.5 && useFont.widthOfTextAtSize(text, size) > boxW - 2) {
      size -= 0.35;
    }
    const textW = useFont.widthOfTextAtSize(text, size);
    const leftAlign = field.type === "text" || field.type === "name" || field.type === "date";
    page.drawText(text, {
      x: leftAlign ? x + 3 : x + Math.max(2, (boxW - textW) / 2),
      y: y + Math.max(1, (boxH - size) / 2),
      size,
      font: useFont,
      color: gold,
    });
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

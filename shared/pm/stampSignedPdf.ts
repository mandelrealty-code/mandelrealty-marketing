import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { SignField } from "./signFields.js";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export async function stampSignedPdf(input: {
  pdfBuffer: Buffer;
  fields: SignField[];
  signerName: string;
  signedOnLabel: string;
  signaturePng?: Buffer | null;
}): Promise<Buffer> {
  const doc = await PDFDocument.load(input.pdfBuffer);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  let signatureImage = null as Awaited<ReturnType<typeof doc.embedPng>> | null;
  if (input.signaturePng && input.signaturePng.length > 20) {
    try {
      signatureImage = await doc.embedPng(input.signaturePng);
    } catch {
      try {
        signatureImage = await doc.embedPng(
          Buffer.from(
            input.signaturePng.toString("utf8").replace(/^data:image\/\w+;base64,/, ""),
            "base64",
          ),
        );
      } catch {
        signatureImage = null;
      }
    }
  }

  const gold = rgb(0.15, 0.15, 0.15);

  for (const field of input.fields) {
    const page = doc.getPage(field.page - 1);
    if (!page) continue;
    const { width, height } = page.getSize();
    const x = clamp(field.x, 0, 1) * width;
    const boxH = clamp(field.h, 0.02, 1) * height;
    const boxW = clamp(field.w, 0.04, 1) * width;
    const y = height - clamp(field.y, 0, 1) * height - boxH;

    if (field.type === "signature" && signatureImage) {
      const scale = Math.min(boxW / signatureImage.width, boxH / signatureImage.height);
      const drawW = signatureImage.width * scale;
      const drawH = signatureImage.height * scale;
      page.drawImage(signatureImage, {
        x: x + (boxW - drawW) / 2,
        y: y + (boxH - drawH) / 2,
        width: drawW,
        height: drawH,
      });
      continue;
    }

    const text =
      field.type === "date"
        ? input.signedOnLabel
        : input.signerName.trim();
    if (!text) continue;
    const useFont = field.type === "signature" ? italic : font;
    let size = field.type === "signature" ? Math.min(18, boxH * 0.55) : Math.min(12, boxH * 0.55);
    while (size > 7 && useFont.widthOfTextAtSize(text, size) > boxW - 4) {
      size -= 0.5;
    }
    const textW = useFont.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: x + Math.max(2, (boxW - textW) / 2),
      y: y + (boxH - size) / 2,
      size,
      font: useFont,
      color: gold,
    });
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

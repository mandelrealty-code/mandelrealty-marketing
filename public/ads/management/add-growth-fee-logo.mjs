/**
 * Composite MRG logo to the left of "Mandel Realty Group" on Growth Fee ads.
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO = path.join(__dirname, "../../mrg-logo-white.png");
const DIR = path.join(__dirname, "2026-09-01/growth-fee");
const ASSETS = path.join(
  process.env.HOME,
  ".cursor/projects/Users-Shane-Documents-Stravo-CleanerDashboard-Git-mandelrealty-marketing/assets"
);

/** Tuned per ratio — logo sits just left of existing header text */
const PLACEMENT = {
  GrowthFee_preview: { logoScale: 0.038, left: 0.034, top: 0.038 },
  GrowthFee_4x5_preview: { logoScale: 0.038, left: 0.034, top: 0.058 },
  GrowthFee_9x16_preview: { logoScale: 0.038, left: 0.034, top: 0.088 },
};

const SOURCE = {
  GrowthFee_preview: path.join(ASSETS, "GrowthFee_preview-939728dc-1be2-4ccc-910d-2e0ea606714a.jpg"),
  GrowthFee_4x5_preview: path.join(ASSETS, "GrowthFee_4x5_preview-05957f4c-82cc-4c19-84d3-493f3b827afb.jpg"),
  GrowthFee_9x16_preview: path.join(ASSETS, "GrowthFee_9x16_preview-bae7cfd6-3724-4925-ac56-4d7a3c6aa05e.jpg"),
};

const files = [
  "GrowthFee_preview.png",
  "GrowthFee_4x5_preview.png",
  "GrowthFee_9x16_preview.png",
];

for (const file of files) {
  const key = file.replace(".png", "");
  const input = SOURCE[key] && fs.existsSync(SOURCE[key]) ? SOURCE[key] : path.join(DIR, file);
  const p = PLACEMENT[key];
  const meta = await sharp(input).metadata();
  const w = meta.width;
  const h = meta.height;
  const size = Math.round(w * p.logoScale);
  const left = Math.round(w * p.left);
  const top = Math.round(h * p.top);

  const logo = await sharp(LOGO).resize(size, size).png().toBuffer();
  const out = path.join(DIR, file);
  await sharp(input).composite([{ input: logo, left, top }]).png().toFile(out);
  console.log(file, `logo ${size}px @ ${left},${top}`);
}

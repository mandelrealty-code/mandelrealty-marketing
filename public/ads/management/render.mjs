import puppeteer from "puppeteer-core";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** Render an HTML ad to PNG. Usage: node render.mjs v1-name */
async function render(name, size = { width: 1080, height: 1350 }) {
  const htmlPath = path.join(__dirname, `${name}.html`);
  const outPath = path.join(__dirname, `${name}.png`);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: size.width,
      height: size.height,
      deviceScaleFactor: 2,
    });
    await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0" });
    await page.evaluateHandle("document.fonts.ready");
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({
      path: outPath,
      type: "png",
      clip: { x: 0, y: 0, width: size.width, height: size.height },
    });
    console.log("Wrote", outPath);
  } finally {
    await browser.close();
  }
}

const names = process.argv.slice(2);
if (names.length === 0) {
  console.error("Usage: node render.mjs <ad-name> [more-names…]");
  process.exit(1);
}
for (const name of names) {
  await render(name.replace(/\.html$/, ""));
}

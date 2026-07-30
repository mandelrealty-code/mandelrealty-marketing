import puppeteer from "puppeteer-core";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function render(name) {
  const htmlPath = path.join(__dirname, `${name}.html`);
  const outPath = path.join(__dirname, `${name}.png`);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 2 });
    await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0" });
    await page.evaluateHandle("document.fonts.ready");
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({
      path: outPath,
      type: "png",
      clip: { x: 0, y: 0, width: 1080, height: 1350 },
    });
    console.log("Wrote", outPath);
  } finally {
    await browser.close();
  }
}

await render("v1-highrise");
await render("v2-villa");

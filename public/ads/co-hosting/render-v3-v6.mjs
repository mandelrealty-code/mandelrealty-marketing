import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const ads = [
  {
    id: "v3-free-upgrade",
    image: "interior-1.jpg",
    objectPosition: "center 40%",
    headline: "FREE AIRBNB MAKEOVERS",
    headlineSize: 72,
    body: "Downtown Toronto hosts only. If we see the upside, we furnish it brand new and run everything, photos, pricing, guests, cleaning.",
    proofLabel: "One Toronto owner",
    proofLeftLabel: "All of 2025",
    proofLeftValue: "$26K",
    proofRightLabel: "May-July after we took over",
    proofRightValue: "$33K",
    scarcity: "Limited to 20 applicants this quarter.",
  },
  {
    id: "v4-left-on-table",
    image: "interior-4.jpg",
    objectPosition: "center 35%",
    headline: "FREE AIRBNB MAKEOVERS",
    headlineSize: 72,
    body: "Most Toronto hosts are, without knowing it. We furnish qualifying units free, then manage the listing end to end.",
    proofLabel: "Same unit. No renovations.",
    proofLeftLabel: "Full year 2025",
    proofLeftValue: "$26K",
    proofRightLabel: "First 3 months with us",
    proofRightValue: "$33K",
    scarcity: "20 downtown Toronto spots this quarter.",
  },
  {
    id: "v5-ninety-days",
    image: "interior-5.jpg",
    objectPosition: "center 30%",
    headline: "FREE AIRBNB MAKEOVERS",
    headlineSize: 72,
    body: "No renovations, new furniture, new photos, full management, at our cost. One client hit $33K by July after a $26K year. On pace to 4x their 2025 revenue.",
    proofLabel: "Real downtown Toronto client",
    proofLeftLabel: "2025 total",
    proofLeftValue: "$26K",
    proofRightLabel: "On pace for 2026",
    proofRightValue: "4x",
    scarcity: "Only 20 applicants this quarter.",
  },
  {
    id: "v6-partnership",
    image: "interior-6.jpg",
    objectPosition: "center 40%",
    headline: "FREE AIRBNB MAKEOVERS",
    headlineSize: 72,
    body: "Designers furnish your downtown Toronto Airbnb free. We handle guests, pricing, cleaning, maintenance, guidebook, everything.",
    proofLabel: "One Toronto owner",
    proofLeftLabel: "Previous year",
    proofLeftValue: "$26K",
    proofRightLabel: "3 months after takeover",
    proofRightValue: "$33K",
    scarcity: "Apply to see if your unit qualifies.",
  },
];

function htmlFor(ad) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #0a0a0a; }
  body { width: 1080px; height: 1350px; overflow: hidden; }
</style>
</head>
<body>
<div style="width: 1080px; height: 1350px; position: relative; overflow: hidden; background: #0a0a0a; font-family: 'Inter Tight', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <img src="./${ad.image}" alt="" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: ${ad.objectPosition}; filter: saturate(0.68) brightness(0.76) contrast(1.06);" />

  <div style="position: absolute; inset: 0; pointer-events: none; background: linear-gradient(to bottom, rgba(10,10,10,0.15) 0%, rgba(10,10,10,0.2) 36%, rgba(10,10,10,0.66) 54%, rgba(10,10,10,0.95) 64%, #0a0a0a 71%);"></div>

  <div style="position: absolute; top: 56px; left: 72px; right: 72px; display: flex; align-items: center; justify-content: space-between;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="width: 10px; height: 10px; background: #f5c518; border-radius: 50%;"></div>
      <div style="font-size: 22px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; color: #ffffff; text-shadow: 0 1px 24px rgba(10,10,10,0.7);">Mandel Realty Group</div>
    </div>
    <div style="font-size: 20px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.72); text-shadow: 0 1px 24px rgba(10,10,10,0.7);">Toronto</div>
  </div>

  <div style="position: absolute; left: 72px; right: 72px; bottom: 76px; display: flex; flex-direction: column; gap: 30px;">
    <div style="display: flex; flex-direction: column; gap: 22px;">
      <h1 style="margin: 0; font-size: ${ad.headlineSize}px; line-height: 0.98; letter-spacing: -0.035em; font-weight: 800; color: #ffffff;">${ad.headline}</h1>
      <p style="margin: 0; font-size: 26px; line-height: 1.5; font-weight: 400; color: #9a9a9a;">${ad.body}</p>
    </div>

    <div style="background: #1c1c1c; border: 1px solid #2a2a2a; border-radius: 20px; padding: 34px 40px; display: flex; flex-direction: column; gap: 22px;">
      <div style="font-size: 17px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #6f6f6f;">${ad.proofLabel}</div>
      <div style="display: flex; align-items: flex-end; gap: 40px;">
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div style="font-size: 21px; font-weight: 500; color: #9a9a9a;">${ad.proofLeftLabel}</div>
          <div style="font-size: 52px; line-height: 1; font-weight: 600; letter-spacing: -0.03em; color: #ffffff;">${ad.proofLeftValue}</div>
        </div>
        <div style="font-size: 44px; line-height: 1; font-weight: 500; color: #f5c518; padding-bottom: 6px;">→</div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div style="font-size: 21px; font-weight: 500; color: #9a9a9a;">${ad.proofRightLabel}</div>
          <div style="font-size: 92px; line-height: 0.9; font-weight: 800; letter-spacing: -0.04em; color: #f5c518;">${ad.proofRightValue}</div>
        </div>
      </div>
    </div>

    <div style="display: flex; align-items: center; gap: 32px;">
      <div style="background: #f5c518; color: #0a0a0a; font-size: 27px; font-weight: 700; letter-spacing: 0.01em; padding: 25px 52px; border-radius: 999px;">Apply Now</div>
      <div style="font-size: 22px; font-weight: 400; color: #9a9a9a;">${ad.scarcity}</div>
    </div>
  </div>
</div>
</body>
</html>
`;
}

async function render(id) {
  const htmlPath = path.join(__dirname, `${id}.html`);
  const outPath = path.join(__dirname, `${id}.png`);
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

for (const ad of ads) {
  const htmlPath = path.join(__dirname, `${ad.id}.html`);
  fs.writeFileSync(htmlPath, htmlFor(ad));
  console.log("Wrote", htmlPath);
}

await render("v3-free-upgrade");
await render("v4-left-on-table");
await render("v5-ninety-days");
await render("v6-partnership");

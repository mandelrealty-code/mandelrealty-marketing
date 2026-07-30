import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const DEST_ROOT =
  "/Users/Shane/Downloads/Airbnb free makeover ads/meta-selected";

const sizes = {
  "4x5": { w: 1080, h: 1350, label: "4x5_1080x1350" },
  "1x1": { w: 1080, h: 1080, label: "1x1_1080x1080" },
  "9x16": { w: 1080, h: 1920, label: "9x16_1080x1920" },
};

const ads = [
  {
    folder: "02-problem",
    image: "villa.jpg",
    objectPosition: "center 35%",
    body: "80% of Airbnb hosts are leaving 2 to 6x their current revenue on the table, without even knowing it. We furnish your unit brand new and manage everything: photography, pricing, guest comms, cleaning, maintenance. Completely free.",
    bodyShort:
      "80% of hosts leave 2 to 6x revenue on the table. We furnish your unit brand new and manage everything. Completely free.",
    proofLabel: "Real result",
    leftLabel: "Previous year total",
    leftValue: "$26K",
    rightLabel: "3 months with us",
    rightValue: "$33K",
    proofNote: null,
    scarcity: "Only 20 spots this quarter.",
  },
  {
    folder: "04-proof",
    image: "interior-4.jpg",
    objectPosition: "center 35%",
    body: "One host made $26,000 in all of 2025. We took over, replaced the furniture, took new photos, and built a custom guidebook. No renovations, no cost. By the end of July, they'd already made $33,000. They're on pace to 4x their 2025 revenue.",
    bodyShort:
      "One host made $26K in all of 2025. After we took over: new furniture, new photos, custom guidebook. By July: $33K. On pace to 4x.",
    proofLabel: "Before → After",
    leftLabel: "All of 2025",
    leftValue: "$26K",
    rightLabel: "May-July 2026",
    rightValue: "$33K",
    proofNote: null,
    scarcity: "Only 20 applicants accepted this quarter.",
  },
  {
    folder: "06-full-arc",
    image: "interior-6.jpg",
    objectPosition: "center 40%",
    body: "New furniture. New photos. Full management. All free. Most hosts are earning a fraction of what their unit could make. We close that gap. One client went from $26K a year to $33K in 3 months, on pace to 4x their revenue.",
    bodyShort:
      "New furniture. New photos. Full management. All free. One client: $26K a year to $33K in 3 months, on pace to 4x.",
    proofLabel: "The result",
    leftLabel: "2025",
    leftValue: "$26K",
    rightLabel: "2026 (3 months)",
    rightValue: "$33K",
    proofNote: "4x pace",
    scarcity: "20 spots available this quarter.",
  },
];

function scale(sizeKey) {
  if (sizeKey === "1x1") {
    return {
      padX: 52,
      padTop: 44,
      padBottom: 52,
      gap: 18,
      headline: 54,
      body: 20,
      bodyGap: 14,
      proofPad: 24,
      proofLabel: 15,
      leftVal: 44,
      rightVal: 68,
      leftLabel: 18,
      arrow: 32,
      ctaPadY: 18,
      ctaPadX: 40,
      ctaFont: 24,
      scarcity: 18,
      brand: 18,
      loc: 16,
      brandGap: 10,
      dot: 8,
      useShortBody: true,
      gradient:
        "linear-gradient(to bottom, rgba(10,10,10,0.2) 0%, rgba(10,10,10,0.35) 28%, rgba(10,10,10,0.82) 48%, #0a0a0a 62%)",
      safeTop: 0,
      safeBottom: 0,
    };
  }
  if (sizeKey === "9x16") {
    return {
      padX: 64,
      padTop: 120,
      padBottom: 160,
      gap: 28,
      headline: 72,
      body: 24,
      bodyGap: 20,
      proofPad: 32,
      proofLabel: 17,
      leftVal: 56,
      rightVal: 88,
      leftLabel: 20,
      arrow: 40,
      ctaPadY: 24,
      ctaPadX: 48,
      ctaFont: 28,
      scarcity: 22,
      brand: 20,
      loc: 18,
      brandGap: 12,
      dot: 10,
      useShortBody: false,
      gradient:
        "linear-gradient(to bottom, rgba(10,10,10,0.25) 0%, rgba(10,10,10,0.2) 35%, rgba(10,10,10,0.7) 55%, rgba(10,10,10,0.96) 68%, #0a0a0a 76%)",
      safeTop: 0,
      safeBottom: 0,
    };
  }
  // 4x5
  return {
    padX: 72,
    padTop: 56,
    padBottom: 68,
    gap: 24,
    headline: 68,
    body: 22,
    bodyGap: 18,
    proofPad: 30,
    proofLabel: 17,
    leftVal: 52,
    rightVal: 84,
    leftLabel: 20,
    arrow: 40,
    ctaPadY: 22,
    ctaPadX: 48,
    ctaFont: 26,
    scarcity: 21,
    brand: 22,
    loc: 20,
    brandGap: 12,
    dot: 10,
    useShortBody: false,
    gradient:
      "linear-gradient(to bottom, rgba(10,10,10,0.15) 0%, rgba(10,10,10,0.2) 32%, rgba(10,10,10,0.7) 50%, rgba(10,10,10,0.96) 62%, #0a0a0a 70%)",
    safeTop: 0,
    safeBottom: 0,
  };
}

function htmlFor(ad, sizeKey) {
  const { w, h } = sizes[sizeKey];
  const s = scale(sizeKey);
  const body = s.useShortBody ? ad.bodyShort : ad.body;
  const note = ad.proofNote
    ? `<div style="font-size: ${Math.max(16, s.leftLabel - 2)}px; font-weight: 500; color: #9a9a9a;"><span style="color:#f5c518;font-weight:700;">4x</span> pace</div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${w}px; height: ${h}px; overflow: hidden; background: #0a0a0a; }
  body { font-family: 'Inter Tight', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
</style>
</head>
<body>
<div style="width: ${w}px; height: ${h}px; position: relative; overflow: hidden; background: #0a0a0a;">
  <img src="../${ad.image}" alt="" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: ${ad.objectPosition}; filter: saturate(0.68) brightness(0.74) contrast(1.06);" />
  <div style="position: absolute; inset: 0; pointer-events: none; background: ${s.gradient};"></div>

  <div style="position: absolute; top: ${s.padTop}px; left: ${s.padX}px; right: ${s.padX}px; display: flex; align-items: center; justify-content: space-between; z-index: 2;">
    <div style="display: flex; align-items: center; gap: ${s.brandGap}px;">
      <div style="width: ${s.dot}px; height: ${s.dot}px; background: #f5c518; border-radius: 50%;"></div>
      <div style="font-size: ${s.brand}px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; color: #ffffff; text-shadow: 0 1px 24px rgba(10,10,10,0.7);">Mandel Realty Group</div>
    </div>
    <div style="font-size: ${s.loc}px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.72); text-shadow: 0 1px 24px rgba(10,10,10,0.7);">Toronto</div>
  </div>

  <div style="position: absolute; left: ${s.padX}px; right: ${s.padX}px; bottom: ${s.padBottom}px; display: flex; flex-direction: column; gap: ${s.gap}px; z-index: 2;">
    <div style="display: flex; flex-direction: column; gap: ${s.bodyGap}px;">
      <h1 style="font-size: ${s.headline}px; line-height: 0.95; letter-spacing: -0.035em; font-weight: 800; color: #ffffff;">FREE AIRBNB MAKEOVERS</h1>
      <p style="font-size: ${s.body}px; line-height: 1.45; font-weight: 400; color: #9a9a9a;">${body}</p>
    </div>

    <div style="background: #1c1c1c; border: 1px solid #2a2a2a; border-radius: 20px; padding: ${s.proofPad}px ${s.proofPad + 6}px; display: flex; flex-direction: column; gap: ${Math.max(14, s.gap - 6)}px;">
      <div style="font-size: ${s.proofLabel}px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #6f6f6f;">${ad.proofLabel}</div>
      <div style="display: flex; align-items: flex-end; gap: ${Math.max(24, s.gap + 8)}px;">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="font-size: ${s.leftLabel}px; font-weight: 500; color: #9a9a9a;">${ad.leftLabel}</div>
          <div style="font-size: ${s.leftVal}px; line-height: 1; font-weight: 600; letter-spacing: -0.03em; color: #ffffff;">${ad.leftValue}</div>
        </div>
        <div style="font-size: ${s.arrow}px; line-height: 1; font-weight: 500; color: #f5c518; padding-bottom: 4px;">→</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="font-size: ${s.leftLabel}px; font-weight: 500; color: #9a9a9a;">${ad.rightLabel}</div>
          <div style="font-size: ${s.rightVal}px; line-height: 0.9; font-weight: 800; letter-spacing: -0.04em; color: #f5c518;">${ad.rightValue}</div>
        </div>
      </div>
      ${note}
    </div>

    <div style="display: flex; align-items: center; gap: ${Math.max(20, s.gap)}px; flex-wrap: wrap;">
      <div style="background: #f5c518; color: #0a0a0a; font-size: ${s.ctaFont}px; font-weight: 700; letter-spacing: 0.01em; padding: ${s.ctaPadY}px ${s.ctaPadX}px; border-radius: 999px;">Apply Now</div>
      <div style="font-size: ${s.scarcity}px; font-weight: 400; color: #9a9a9a;">${ad.scarcity}</div>
    </div>
  </div>
</div>
</body>
</html>`;
}

async function renderFile(htmlPath, outPath, w, h) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
    await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0" });
    await page.evaluateHandle("document.fonts.ready");
    await new Promise((r) => setTimeout(r, 350));
    await page.screenshot({
      path: outPath,
      type: "png",
      clip: { x: 0, y: 0, width: w, height: h },
    });
    console.log("Wrote", outPath);
  } finally {
    await browser.close();
  }
}

fs.mkdirSync(DEST_ROOT, { recursive: true });

const workDir = path.join(__dirname, "meta-selected-build");
fs.mkdirSync(workDir, { recursive: true });

for (const ad of ads) {
  const destDir = path.join(DEST_ROOT, ad.folder);
  fs.mkdirSync(destDir, { recursive: true });

  for (const sizeKey of Object.keys(sizes)) {
    const { w, h, label } = sizes[sizeKey];
    const htmlName = `${ad.folder}-${sizeKey}.html`;
    const htmlPath = path.join(workDir, htmlName);
    fs.writeFileSync(htmlPath, htmlFor(ad, sizeKey));
    const outPath = path.join(destDir, `${label}.png`);
    await renderFile(htmlPath, outPath, w, h);
  }
}

const readme = `Meta upload pack — Free Airbnb Makeovers
========================================

Selected creatives: 02-problem, 04-proof, 06-full-arc

Each folder has:
  4x5_1080x1350.png   Feed (primary — upload first)
  1x1_1080x1080.png   Feed square / Right column
  9x16_1080x1920.png  Stories & Reels

In Ads Manager: create 3 ads (one creative each).
Per ad, upload all 3 ratios. Meta serves the right one by placement.

Suggested Version A copy (same Instant Form for all):

--- 02-problem ---
Primary: 80% of Airbnb hosts are leaving 2 to 6x their current revenue on the table, without even knowing it. We furnish your unit brand new and manage everything: photography, pricing, guest comms, cleaning, maintenance. Completely free.
Headline: Free Airbnb Makeovers
Description: Apply to see if your unit qualifies. 20 spots this quarter.

--- 04-proof ---
Primary: One host made $26,000 in all of 2025. After we took over, they hit $33,000 by July. No renovations. New furniture, new photos, custom guidebook. On pace to 4x.
Headline: Free Airbnb Makeovers
Description: Real result. Apply if your unit qualifies.

--- 06-full-arc ---
Primary: New furniture. New photos. Full management. All free. Most hosts are earning a fraction of what their unit could make. We close that gap. One client went from $26K a year to $33K in 3 months, on pace to 4x their revenue.
Headline: Free Airbnb Makeovers
Description: 20 spots available this quarter.
`;

fs.writeFileSync(path.join(DEST_ROOT, "README.txt"), readme);
console.log("Done:", DEST_ROOT);

import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const ads = [
  {
    id: "v1-highrise",
    out: "01-investment",
    image: "highrise.jpg",
    objectPosition: "center center",
    body: "We invest in your short-term rental and upgrade it, completely free. Brand new furniture, professional photos, full management. Almost 80% of hosts are leaving 2-6x their revenue on the table without knowing it. We fix that, at no cost to you.",
    bodySize: 22,
    proofLabel: "One host",
    leftLabel: "All of 2025",
    leftValue: "$26K",
    rightLabel: "3 months after we took over",
    rightValue: "$33K",
    proofNote: "On pace for 4x",
    scarcity: "Limited to 20 applicants this quarter.",
  },
  {
    id: "v2-villa",
    out: "02-problem",
    image: "villa.jpg",
    objectPosition: "center 35%",
    body: "80% of Airbnb hosts are leaving 2 to 6x their current revenue on the table, without even knowing it. We furnish your unit brand new and manage everything: photography, pricing, guest comms, cleaning, maintenance. Completely free.",
    bodySize: 22,
    proofLabel: "Real result",
    leftLabel: "Previous year total",
    leftValue: "$26K",
    rightLabel: "3 months with us",
    rightValue: "$33K",
    proofNote: null,
    scarcity: "Only 20 spots this quarter.",
  },
  {
    id: "v3-free-upgrade",
    out: "03-how-it-works",
    image: "interior-1.jpg",
    objectPosition: "center 40%",
    body: "Our team of interior designers and hospitality experts reviews your listing. If your unit has the potential to earn more, we furnish it with new furniture, decor, pull-out beds, whatever it takes. Completely free. Then we run everything else, too.",
    bodySize: 22,
    proofLabel: "The upgrade",
    leftLabel: "Cost to you",
    leftValue: "$0",
    rightLabel: "$26K/year → $33K in 3 months",
    rightValue: "Client",
    proofNote: null,
    specialUpgrade: true,
    scarcity: "Limited to 20 applicants this quarter.",
  },
  {
    id: "v4-left-on-table",
    out: "04-proof",
    image: "interior-4.jpg",
    objectPosition: "center 35%",
    body: "One host made $26,000 in all of 2025. We took over, replaced the furniture, took new photos, and built a custom guidebook. No renovations, no cost. By the end of July, they'd already made $33,000. They're on pace to 4x their 2025 revenue.",
    bodySize: 22,
    proofLabel: "Before → After",
    leftLabel: "All of 2025",
    leftValue: "$26K",
    rightLabel: "May-July 2026",
    rightValue: "$33K",
    proofNote: null,
    scarcity: "Only 20 applicants accepted this quarter.",
  },
  {
    id: "v5-ninety-days",
    out: "05-partnership",
    image: "interior-5.jpg",
    objectPosition: "center 30%",
    body: "We furnish your unit and manage everything for free. In exchange, we take a percentage of the revenue we help generate. It's not a service, it's a partnership: we're motivated to grow your bookings because that's how we grow too.",
    bodySize: 22,
    proofLabel: "One host",
    leftLabel: "2025 total",
    leftValue: "$26K",
    rightLabel: "3 months after takeover",
    rightValue: "$33K",
    proofNote: null,
    scarcity: "Limited to 20 partners this quarter.",
  },
  {
    id: "v6-partnership",
    out: "06-full-arc",
    image: "interior-6.jpg",
    objectPosition: "center 40%",
    body: "New furniture. New photos. Full management. All free. Most hosts are earning a fraction of what their unit could make. We close that gap. One client went from $26K a year to $33K in 3 months, on pace to 4x their revenue.",
    bodySize: 22,
    proofLabel: "The result",
    leftLabel: "2025",
    leftValue: "$26K",
    rightLabel: "2026 (3 months)",
    rightValue: "$33K",
    proofNote: "4x pace",
    scarcity: "20 spots available this quarter.",
  },
  {
    id: "v7-invest-free",
    out: "07-scarcity",
    image: "interior-7.jpg",
    objectPosition: "center 35%",
    body: "We're only taking 20 applicants this quarter. If you own a short-term rental, we'll furnish it brand new and manage everything for free, with the goal of growing your revenue 2-4x. One client already hit $33K in 3 months, up from $26K all last year.",
    bodySize: 22,
    proofLabel: "Qualifying units see",
    leftLabel: "Per year before",
    leftValue: "$26K",
    rightLabel: "in 3 months",
    rightValue: "$33K",
    proofNote: null,
    scarcity: "Find out if your unit qualifies.",
  },
];

function proofBox(ad) {
  if (ad.specialUpgrade) {
    return `
    <div style="background: #1c1c1c; border: 1px solid #2a2a2a; border-radius: 20px; padding: 30px 36px; display: flex; flex-direction: column; gap: 20px;">
      <div style="font-size: 17px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #6f6f6f;">${ad.proofLabel}</div>
      <div style="display: flex; align-items: flex-end; gap: 32px;">
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div style="font-size: 20px; font-weight: 500; color: #9a9a9a;">Cost to you</div>
          <div style="font-size: 72px; line-height: 0.9; font-weight: 800; letter-spacing: -0.04em; color: #f5c518;">$0</div>
        </div>
        <div style="font-size: 40px; line-height: 1; font-weight: 500; color: #f5c518; padding-bottom: 8px;">→</div>
        <div style="display: flex; flex-direction: column; gap: 8px; padding-bottom: 6px;">
          <div style="font-size: 20px; font-weight: 500; color: #9a9a9a;">Client result</div>
          <div style="font-size: 28px; line-height: 1.2; font-weight: 700; letter-spacing: -0.02em; color: #ffffff;">$26K/year → $33K in 3 months</div>
        </div>
      </div>
    </div>`;
  }

  const note = ad.proofNote
    ? `<div style="font-size: 20px; font-weight: 500; color: #9a9a9a;">${ad.proofNote.replace(/4x/g, '<span style="color:#f5c518;font-weight:700;">4x</span>')}</div>`
    : "";

  return `
    <div style="background: #1c1c1c; border: 1px solid #2a2a2a; border-radius: 20px; padding: 30px 36px; display: flex; flex-direction: column; gap: 20px;">
      <div style="font-size: 17px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: #6f6f6f;">${ad.proofLabel}</div>
      <div style="display: flex; align-items: flex-end; gap: 36px;">
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div style="font-size: 20px; font-weight: 500; color: #9a9a9a;">${ad.leftLabel}</div>
          <div style="font-size: 52px; line-height: 1; font-weight: 600; letter-spacing: -0.03em; color: #ffffff;">${ad.leftValue}</div>
        </div>
        <div style="font-size: 40px; line-height: 1; font-weight: 500; color: #f5c518; padding-bottom: 6px;">→</div>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div style="font-size: 20px; font-weight: 500; color: #9a9a9a;">${ad.rightLabel}</div>
          <div style="font-size: 84px; line-height: 0.9; font-weight: 800; letter-spacing: -0.04em; color: #f5c518;">${ad.rightValue}</div>
        </div>
      </div>
      ${note}
    </div>`;
}

function htmlFor(ad) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #0a0a0a; }
  body { width: 1080px; height: 1350px; overflow: hidden; }
</style>
</head>
<body>
<div style="width: 1080px; height: 1350px; position: relative; overflow: hidden; background: #0a0a0a; font-family: 'Inter Tight', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <img src="./${ad.image}" alt="" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: ${ad.objectPosition}; filter: saturate(0.68) brightness(0.74) contrast(1.06);" />
  <div style="position: absolute; inset: 0; pointer-events: none; background: linear-gradient(to bottom, rgba(10,10,10,0.15) 0%, rgba(10,10,10,0.2) 32%, rgba(10,10,10,0.7) 50%, rgba(10,10,10,0.96) 62%, #0a0a0a 70%);"></div>

  <div style="position: absolute; top: 56px; left: 72px; right: 72px; display: flex; align-items: center; justify-content: space-between;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="width: 10px; height: 10px; background: #f5c518; border-radius: 50%;"></div>
      <div style="font-size: 22px; font-weight: 600; letter-spacing: 0.22em; text-transform: uppercase; color: #ffffff; text-shadow: 0 1px 24px rgba(10,10,10,0.7);">Mandel Realty Group</div>
    </div>
    <div style="font-size: 20px; font-weight: 500; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.72); text-shadow: 0 1px 24px rgba(10,10,10,0.7);">Toronto</div>
  </div>

  <div style="position: absolute; left: 72px; right: 72px; bottom: 68px; display: flex; flex-direction: column; gap: 24px;">
    <div style="display: flex; flex-direction: column; gap: 18px;">
      <h1 style="margin: 0; font-size: 68px; line-height: 0.95; letter-spacing: -0.035em; font-weight: 800; color: #ffffff;">FREE AIRBNB MAKEOVERS</h1>
      <p style="margin: 0; font-size: ${ad.bodySize}px; line-height: 1.45; font-weight: 400; color: #9a9a9a;">${ad.body}</p>
    </div>
    ${proofBox(ad)}
    <div style="display: flex; align-items: center; gap: 28px;">
      <div style="background: #f5c518; color: #0a0a0a; font-size: 26px; font-weight: 700; letter-spacing: 0.01em; padding: 22px 48px; border-radius: 999px;">Apply Now</div>
      <div style="font-size: 21px; font-weight: 400; color: #9a9a9a;">${ad.scarcity}</div>
    </div>
  </div>
</div>
</body>
</html>`;
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
    await new Promise((r) => setTimeout(r, 400));
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

const destStatics = "/Users/Shane/Downloads/Airbnb free makeover ads/statics";

for (const ad of ads) {
  const htmlPath = path.join(__dirname, `${ad.id}.html`);
  fs.writeFileSync(htmlPath, htmlFor(ad));
  console.log("Wrote", htmlPath);
}

for (const ad of ads) {
  await render(ad.id);
  const src = path.join(__dirname, `${ad.id}.png`);
  const dest = path.join(destStatics, `${ad.out}.png`);
  fs.copyFileSync(src, dest);
  console.log("Copied", dest);
}

import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const shell = (inner) => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1080px; height: 1080px; overflow: hidden; background: #0a0a0a; }
  body { font-family: 'Inter Tight', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
</style>
</head>
<body>${inner}</body>
</html>`;

const header = `
  <div style="position:absolute; top:48px; left:56px; right:56px; display:flex; align-items:center; justify-content:space-between; z-index:2;">
    <div style="display:flex; align-items:center; gap:12px;">
      <div style="width:10px; height:10px; background:#f5c518; border-radius:50%;"></div>
      <div style="font-size:20px; font-weight:600; letter-spacing:0.22em; text-transform:uppercase; color:#ffffff;">Mandel Realty Group</div>
    </div>
    <div style="font-size:18px; font-weight:500; letter-spacing:0.14em; text-transform:uppercase; color:rgba(255,255,255,0.55);">Toronto</div>
  </div>`;

const dots = (n) => `
  <div style="position:absolute; bottom:48px; left:0; right:0; display:flex; justify-content:center; gap:10px; z-index:2;">
    ${[1, 2, 3, 4, 5, 6]
      .map(
        (i) =>
          `<div style="width:${i === n ? 28 : 10}px; height:10px; border-radius:999px; background:${i === n ? "#f5c518" : "#2a2a2a"};"></div>`
      )
      .join("")}
  </div>`;

const slides = {
  "01-hook": shell(`
<div style="width:1080px; height:1080px; position:relative; overflow:hidden; background:#0a0a0a;">
  <img src="./interior-1.jpg" alt="" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:center 40%; filter:saturate(0.65) brightness(0.55) contrast(1.05);" />
  <div style="position:absolute; inset:0; background:linear-gradient(to bottom, rgba(10,10,10,0.35) 0%, rgba(10,10,10,0.55) 45%, rgba(10,10,10,0.92) 72%, #0a0a0a 100%);"></div>
  ${header}
  <div style="position:absolute; left:56px; right:56px; bottom:110px; z-index:2; display:flex; flex-direction:column; gap:28px;">
    <div style="font-size:18px; font-weight:600; letter-spacing:0.2em; text-transform:uppercase; color:#f5c518;">For Toronto hosts</div>
    <h1 style="font-size:88px; line-height:0.95; font-weight:800; letter-spacing:-0.035em; color:#ffffff;">FREE AIRBNB MAKEOVERS</h1>
    <p style="font-size:32px; line-height:1.3; font-weight:500; color:#9a9a9a;">Your place is probably making 1/4 of what it could. We'll fix it, for free.</p>
  </div>
  ${dots(1)}
</div>`),

  "02-problem": shell(`
<div style="width:1080px; height:1080px; position:relative; overflow:hidden; background:#0a0a0a;">
  <img src="./highrise.jpg" alt="" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; filter:saturate(0.55) brightness(0.45) contrast(1.1);" />
  <div style="position:absolute; inset:0; background:linear-gradient(to bottom, rgba(10,10,10,0.4) 0%, rgba(10,10,10,0.75) 50%, #0a0a0a 100%);"></div>
  ${header}
  <div style="position:absolute; left:56px; right:56px; top:160px; bottom:110px; z-index:2; display:flex; flex-direction:column; justify-content:center; gap:36px;">
    <div style="font-size:18px; font-weight:600; letter-spacing:0.2em; text-transform:uppercase; color:#f5c518;">Own a short-term rental in Toronto?</div>
    <h1 style="font-size:68px; line-height:1.02; font-weight:800; letter-spacing:-0.035em; color:#ffffff;">80% of Airbnb hosts are leaving <span style="color:#f5c518;">2-6x</span> their current revenue on the table.</h1>
  </div>
  ${dots(2)}
</div>`),

  "03-furnish": shell(`
<div style="width:1080px; height:1080px; position:relative; overflow:hidden; background:#0a0a0a;">
  <img src="./interior-5.jpg" alt="" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:center 30%; filter:saturate(0.65) brightness(0.5) contrast(1.05);" />
  <div style="position:absolute; inset:0; background:linear-gradient(to bottom, rgba(10,10,10,0.35) 0%, rgba(10,10,10,0.7) 55%, #0a0a0a 100%);"></div>
  ${header}
  <div style="position:absolute; left:56px; right:56px; bottom:110px; z-index:2; display:flex; flex-direction:column; gap:26px;">
    <div style="font-size:18px; font-weight:600; letter-spacing:0.2em; text-transform:uppercase; color:#f5c518;">Here's how we fix it</div>
    <h1 style="font-size:58px; line-height:1.05; font-weight:800; letter-spacing:-0.03em; color:#ffffff;">We furnish your entire unit, brand new furniture, decor, everything, for free.</h1>
    <div style="display:flex; gap:16px; flex-wrap:wrap;">
      <div style="background:#1c1c1c; border:1px solid #2a2a2a; border-radius:999px; padding:16px 28px; font-size:24px; font-weight:600; color:#ffffff;">No upfront cost</div>
      <div style="background:#1c1c1c; border:1px solid #2a2a2a; border-radius:999px; padding:16px 28px; font-size:24px; font-weight:600; color:#ffffff;">No hidden fees</div>
    </div>
  </div>
  ${dots(3)}
</div>`),

  "04-manage": shell(`
<div style="width:1080px; height:1080px; position:relative; overflow:hidden; background:#0a0a0a;">
  ${header}
  <div style="position:absolute; left:56px; right:56px; top:150px; bottom:110px; display:flex; flex-direction:column; gap:32px;">
    <div style="font-size:18px; font-weight:600; letter-spacing:0.2em; text-transform:uppercase; color:#f5c518;">Then we manage everything</div>
    <h1 style="font-size:56px; line-height:1.05; font-weight:800; letter-spacing:-0.03em; color:#ffffff;">Photography. Pricing. Guest comms. Cleaning. Maintenance.</h1>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:8px;">
      ${["Photography", "Dynamic pricing", "Guest communication", "Cleaning", "Maintenance", "Custom guidebook"]
        .map(
          (t) =>
            `<div style="background:#141414; border:1px solid #2a2a2a; border-radius:16px; padding:22px 24px; font-size:24px; font-weight:600; color:#ffffff;">${t}</div>`
        )
        .join("")}
    </div>
    <p style="font-size:28px; line-height:1.4; font-weight:700; color:#ffffff; margin-top:8px;">It's a partnership, not a service.</p>
  </div>
  ${dots(4)}
</div>`),

  "05-proof": shell(`
<div style="width:1080px; height:1080px; position:relative; overflow:hidden; background:#0a0a0a;">
  <img src="./interior-4.jpg" alt="" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; filter:saturate(0.55) brightness(0.4) contrast(1.08);" />
  <div style="position:absolute; inset:0; background:linear-gradient(to bottom, rgba(10,10,10,0.45) 0%, rgba(10,10,10,0.82) 50%, #0a0a0a 100%);"></div>
  ${header}
  <div style="position:absolute; left:56px; right:56px; top:150px; bottom:110px; z-index:2; display:flex; flex-direction:column; justify-content:center; gap:36px;">
    <div style="font-size:18px; font-weight:600; letter-spacing:0.2em; text-transform:uppercase; color:#f5c518;">Real numbers</div>
    <div style="background:#1c1c1c; border:1px solid #2a2a2a; border-radius:24px; padding:40px 44px; display:flex; flex-direction:column; gap:28px;">
      <div style="font-size:17px; font-weight:600; letter-spacing:0.18em; text-transform:uppercase; color:#6f6f6f;">One Toronto client</div>
      <div style="display:flex; align-items:flex-end; gap:36px;">
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="font-size:22px; font-weight:500; color:#9a9a9a;">All of 2025</div>
          <div style="font-size:64px; line-height:1; font-weight:700; letter-spacing:-0.03em; color:#ffffff;">$26K</div>
        </div>
        <div style="font-size:44px; line-height:1; font-weight:500; color:#f5c518; padding-bottom:8px;">→</div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div style="font-size:22px; font-weight:500; color:#9a9a9a;">May-July 2026</div>
          <div style="font-size:96px; line-height:0.9; font-weight:800; letter-spacing:-0.04em; color:#f5c518;">$33K</div>
        </div>
      </div>
      <div style="font-size:28px; line-height:1.35; font-weight:500; color:#9a9a9a;">On pace to <span style="color:#f5c518; font-weight:800;">4x</span> their annual revenue.</div>
    </div>
  </div>
  ${dots(5)}
</div>`),

  "06-cta": shell(`
<div style="width:1080px; height:1080px; position:relative; overflow:hidden; background:#0a0a0a;">
  <img src="./interior-7.jpg" alt="" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:center 40%; filter:saturate(0.65) brightness(0.45) contrast(1.05);" />
  <div style="position:absolute; inset:0; background:linear-gradient(to bottom, rgba(10,10,10,0.4) 0%, rgba(10,10,10,0.75) 45%, #0a0a0a 100%);"></div>
  ${header}
  <div style="position:absolute; left:56px; right:56px; top:0; bottom:0; z-index:2; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:32px; padding-bottom:40px;">
    <div style="font-size:18px; font-weight:600; letter-spacing:0.2em; text-transform:uppercase; color:#f5c518;">Limited intake</div>
    <h1 style="font-size:72px; line-height:0.98; font-weight:800; letter-spacing:-0.035em; color:#ffffff;">Only 20 applicants this quarter.</h1>
    <p style="font-size:32px; line-height:1.35; font-weight:500; color:#9a9a9a; max-width:900px;">If your unit qualifies, we're all in, furniture, management, everything.</p>
    <div style="display:flex; align-items:center; gap:28px; margin-top:12px;">
      <div style="background:#f5c518; color:#0a0a0a; font-size:28px; font-weight:700; padding:26px 52px; border-radius:999px;">Apply Now</div>
      <div style="font-size:24px; font-weight:500; color:#9a9a9a;">Short-term rental owners</div>
    </div>
  </div>
  ${dots(6)}
</div>`),
};

async function render(id) {
  const htmlPath = path.join(__dirname, `${id}.html`);
  const outPath = path.join(__dirname, `${id}.png`);
  fs.writeFileSync(htmlPath, slides[id]);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });
    await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0" });
    await page.evaluateHandle("document.fonts.ready");
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({
      path: outPath,
      type: "png",
      clip: { x: 0, y: 0, width: 1080, height: 1080 },
    });
    console.log("Wrote", outPath);
  } finally {
    await browser.close();
  }
}

const ids = Object.keys(slides);
for (const id of ids) {
  await render(id);
}

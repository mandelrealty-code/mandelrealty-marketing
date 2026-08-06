import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BUILD_DIR = path.join(__dirname, "meta-build");

/** YYYY-MM-DD dated upload pack. Override with: DATE=2026-08-12 node render-meta.mjs */
function todayStamp() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
const DATE_FOLDER = process.env.DATE || todayStamp();
const UPLOAD_DIR = path.join(__dirname, DATE_FOLDER);

const RATIOS = {
  "4x5": { width: 1080, height: 1350, filename: "4x5_1080x1350.png" },
  "1x1": { width: 1080, height: 1080, filename: "1x1_1080x1080.png" },
  "9x16": { width: 1080, height: 1920, filename: "9x16_1080x1920.png" },
};

const FONT_LINK =
  '<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800&display=swap" rel="stylesheet">';

function page(width, height, body, background) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
${FONT_LINK}
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${width}px; height: ${height}px; overflow: hidden; background: ${background}; }
  body { font-family: "Inter Tight", Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
</style>
</head>
<body>
<main style="width:${width}px;height:${height}px;position:relative;overflow:hidden;background:${background};">
${body}
</main>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* v1 — Free Furnish (before / after split, brand black + yellow)      */
/* ------------------------------------------------------------------ */

const freeFurnishSizes = {
  "4x5": {
    brandTop: 52,
    imageTop: 118,
    imageHeight: 748,
    stampTop: 672,
    stampRight: 70,
    stampSize: 212,
    stampInner: 184,
    stampMain: 70,
    copyBottom: 64,
    copyGap: 26,
    qualifier: 18,
    headline: 82,
    subhead: 30,
    cta: 26,
    ctaY: 22,
    ctaX: 46,
  },
  "1x1": {
    brandTop: 38,
    imageTop: 90,
    imageHeight: 560,
    stampTop: 498,
    stampRight: 58,
    stampSize: 174,
    stampInner: 150,
    stampMain: 56,
    copyBottom: 42,
    copyGap: 16,
    qualifier: 16,
    headline: 68,
    subhead: 25,
    cta: 22,
    ctaY: 17,
    ctaX: 36,
  },
  "9x16": {
    brandTop: 110,
    imageTop: 180,
    imageHeight: 1120,
    stampTop: 1080,
    stampRight: 70,
    stampSize: 224,
    stampInner: 194,
    stampMain: 72,
    copyBottom: 180,
    copyGap: 30,
    qualifier: 20,
    headline: 94,
    subhead: 34,
    cta: 28,
    ctaY: 24,
    ctaX: 48,
  },
};

function freeFurnishHtml(ratio) {
  const { width, height } = RATIOS[ratio];
  const s = freeFurnishSizes[ratio];
  const stampSmall = Math.round(s.stampMain * 0.21);

  return page(
    width,
    height,
    `  <header style="position:absolute;top:${s.brandTop}px;left:64px;right:64px;display:flex;align-items:center;justify-content:space-between;z-index:5;">
    <div style="display:flex;align-items:center;gap:12px;">
      <div style="width:10px;height:10px;background:#f5c518;border-radius:50%;"></div>
      <div style="font-size:21px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:#fff;">Mandel Realty Group</div>
    </div>
    <div style="font-size:19px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.55);">Toronto</div>
  </header>

  <section style="position:absolute;top:${s.imageTop}px;left:0;right:0;height:${s.imageHeight}px;display:flex;overflow:hidden;">
    <div style="position:relative;width:50%;height:100%;overflow:hidden;">
      <img src="../before-room.jpg" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 55%;filter:saturate(.22) brightness(.66) contrast(.95);">
      <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,10,10,.35),rgba(10,10,10,.15) 45%,rgba(10,10,10,.9) 100%);"></div>
      <div style="position:absolute;top:28px;left:32px;font-size:17px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.72);">Before</div>
    </div>
    <div style="position:relative;width:50%;height:100%;overflow:hidden;">
      <img src="../after-room.jpg" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 45%;filter:saturate(1.05) brightness(1.02) contrast(1.06);">
      <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,10,10,.18),rgba(10,10,10,.02) 40%,rgba(10,10,10,.85) 100%);"></div>
      <div style="position:absolute;top:28px;right:32px;font-size:17px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#f5c518;">After</div>
    </div>
    <div style="position:absolute;top:0;bottom:0;left:50%;width:4px;margin-left:-2px;background:#f5c518;"></div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:190px;background:linear-gradient(to bottom,rgba(10,10,10,0),#0a0a0a);"></div>
  </section>

  <div style="position:absolute;top:${s.stampTop}px;right:${s.stampRight}px;width:${s.stampSize}px;height:${s.stampSize}px;z-index:6;transform:rotate(-11deg);">
    <div style="width:100%;height:100%;border-radius:50%;background:#f5c518;box-shadow:0 24px 60px rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;">
      <div style="width:${s.stampInner}px;height:${s.stampInner}px;border-radius:50%;border:3px dashed rgba(10,10,10,.42);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
        <div style="font-size:${stampSmall}px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:rgba(10,10,10,.7);">Furnishing</div>
        <div style="font-size:${s.stampMain}px;line-height:.9;font-weight:800;letter-spacing:-.045em;color:#0a0a0a;">FREE</div>
        <div style="font-size:${stampSmall}px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:rgba(10,10,10,.7);">$0 upfront</div>
      </div>
    </div>
  </div>

  <section style="position:absolute;left:64px;right:64px;bottom:${s.copyBottom}px;display:flex;flex-direction:column;gap:${s.copyGap}px;">
    <div style="font-size:${s.qualifier}px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#f5c518;">For hosts who already have an Airbnb</div>
    <h1 style="font-size:${s.headline}px;line-height:.94;font-weight:800;letter-spacing:-.04em;color:#fff;">WE'LL FURNISH YOUR AIRBNB. <span style="color:#f5c518;">FREE.</span></h1>
    <p style="font-size:${s.subhead}px;line-height:1.32;font-weight:500;color:#c4c4c4;">Help you earn <span style="color:#fff;font-weight:700;">2-3X more</span>. No cost to you.</p>
    <div style="display:flex;align-items:center;gap:26px;margin-top:6px;">
      <div style="background:#f5c518;color:#0a0a0a;font-size:${s.cta}px;font-weight:700;padding:${s.ctaY}px ${s.ctaX}px;border-radius:999px;white-space:nowrap;">Claim My Free Makeover</div>
      <div style="font-size:${Math.max(18, s.cta - 6)}px;line-height:1.35;font-weight:400;color:#9a9a9a;">No catch.<br>Spots limited this quarter.</div>
    </div>
  </section>`,
    "#0a0a0a"
  );
}

/* ------------------------------------------------------------------ */
/* v2 — Stop Self-Managing (navy + cyan, stressed host)                */
/* ------------------------------------------------------------------ */

const NAVY = "#041925";
const CYAN = "#6cd2de";

const painPoints = [
  "Guests messaging you [[at all hours]]",
  "[[Scrambling]] when a cleaner cancels",
  "Forgetting to adjust your [[pricing]]",
  "Doing this on top of your [[real job]]",
];

function highlight(text) {
  return text.replace(
    /\[\[(.+?)\]\]/g,
    `<span style="color:${CYAN};">$1</span>`
  );
}

const selfManagingSizes = {
  "4x5": {
    logoTop: 50,
    logoIcon: 72,
    logoName: 40,
    logoSub: 16,
    headTop: 176,
    headline: 78,
    photoTop: 250,
    photoRight: -50,
    photoWidth: 700,
    photoHeight: 1010,
    photoPosition: "60% 24%",
    listTop: 452,
    listWidth: 580,
    prompt: 34,
    listGap: 44,
    box: 50,
    item: 29,
    bottomOffset: 62,
    kicker: 44,
    byline: 21,
  },
  "1x1": {
    logoTop: 36,
    logoIcon: 58,
    logoName: 32,
    logoSub: 13,
    headTop: 128,
    headline: 64,
    photoTop: 250,
    photoRight: -50,
    photoWidth: 590,
    photoHeight: 830,
    photoPosition: "60% 24%",
    listTop: 352,
    listWidth: 490,
    prompt: 28,
    listGap: 32,
    box: 42,
    item: 25,
    bottomOffset: 44,
    kicker: 36,
    byline: 18,
  },
  "9x16": {
    logoTop: 168,
    logoIcon: 82,
    logoName: 46,
    logoSub: 18,
    headTop: 330,
    headline: 88,
    photoTop: 560,
    photoRight: -30,
    photoWidth: 740,
    photoHeight: 1220,
    photoPosition: "60% 24%",
    listTop: 700,
    listWidth: 640,
    prompt: 38,
    listGap: 50,
    box: 54,
    item: 32,
    bottomOffset: 210,
    kicker: 50,
    byline: 23,
  },
};

function selfManagingHtml(ratio) {
  const { width, height } = RATIOS[ratio];
  const s = selfManagingSizes[ratio];
  const check = Math.round(s.box * 0.56);

  const items = painPoints
    .map(
      (text) => `      <li style="display:flex;align-items:flex-start;gap:${Math.round(s.box * 0.42)}px;list-style:none;">
        <span style="flex:none;width:${s.box}px;height:${s.box}px;border-radius:${Math.round(s.box * 0.28)}px;background:${CYAN};display:flex;align-items:center;justify-content:center;">
          <svg width="${check}" height="${check}" viewBox="0 0 24 24" fill="none" stroke="${NAVY}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>
        </span>
        <span style="font-size:${s.item}px;line-height:1.24;font-weight:600;color:#eef4f7;padding-top:${Math.round(s.box * 0.09)}px;">${highlight(text)}</span>
      </li>`
    )
    .join("\n");

  return page(
    width,
    height,
    `  <div style="position:absolute;inset:0;background:linear-gradient(165deg,#072433 0%,${NAVY} 55%,#02121b 100%);"></div>

  <img src="../stressed-host.png" alt="" style="position:absolute;top:${s.photoTop}px;right:${s.photoRight}px;width:${s.photoWidth}px;height:${s.photoHeight}px;object-fit:cover;object-position:${s.photoPosition};filter:brightness(1.06) saturate(.92);mask-image:linear-gradient(to right,transparent 0%,rgba(0,0,0,.1) 22%,#000 56%),linear-gradient(to bottom,transparent 0%,#000 15%,#000 74%,transparent 97%);mask-composite:intersect;">

  <header style="position:absolute;top:${s.logoTop}px;left:0;right:0;display:flex;align-items:center;justify-content:center;gap:${Math.round(s.logoIcon * 0.26)}px;z-index:4;">
    <img src="../../../mrg-logo-white.png" alt="" style="width:${s.logoIcon}px;height:${s.logoIcon}px;">
    <div style="display:flex;flex-direction:column;gap:${Math.round(s.logoSub * 0.35)}px;">
      <div style="font-size:${s.logoName}px;font-weight:600;letter-spacing:.14em;line-height:1;color:#fff;">MANDEL</div>
      <div style="font-size:${s.logoSub}px;font-weight:500;letter-spacing:.34em;line-height:1;color:rgba(255,255,255,.72);">REALTY GROUP</div>
    </div>
  </header>

  <h1 style="position:absolute;top:${s.headTop}px;left:56px;right:56px;text-align:center;font-size:${s.headline}px;line-height:1.04;font-weight:700;letter-spacing:-.03em;color:#fff;z-index:4;">
    Stop Self-Managing<br><span style="color:${CYAN};">Your Airbnb!</span>
  </h1>

  <section style="position:absolute;top:${s.listTop}px;left:62px;width:${s.listWidth}px;z-index:4;">
    <div style="font-size:${s.prompt}px;font-weight:700;color:#fff;margin-bottom:${s.listGap}px;">Does this sound like you?</div>
    <ul style="display:flex;flex-direction:column;gap:${s.listGap}px;">
${items}
    </ul>
  </section>

  <footer style="position:absolute;bottom:${s.bottomOffset}px;left:40px;right:40px;text-align:center;z-index:4;">
    <div style="font-size:${s.kicker}px;line-height:1.14;font-weight:700;letter-spacing:-.02em;color:#fff;">Turn Your <span style="color:${CYAN};">Airbnb</span> Into <span style="color:${CYAN};">Passive Income!</span></div>
    <div style="margin-top:${Math.round(s.byline * 0.7)}px;font-size:${s.byline}px;font-weight:500;color:rgba(255,255,255,.72);">By Mandel Realty Group</div>
  </footer>`,
    NAVY
  );
}

/* ------------------------------------------------------------------ */
/* v3 — Making You More (editorial hero photo + black copy panel)      */
/* ------------------------------------------------------------------ */

const INK = "#0a0a0a";

const revenueGaps = [
  "Underpriced nights, every week",
  "Empty gaps in your calendar",
  "No time to optimize your listing",
  "Guessing instead of using real data",
];

const makingMoreSizes = {
  "4x5": {
    photoHeight: 700,
    photoPosition: "center 42%",
    padX: 64,
    barGap: 40,
    colGap: 44,
    leftWidth: 545,
    headline: 82,
    stroke: 2.4,
    lead: 24,
    leadGap: 24,
    item: 21,
    itemGap: 19,
    icon: 27,
    barBottom: 100,
    barHeight: 92,
    barText: 30,
    byline: 19,
    bylineBottom: 44,
  },
  "1x1": {
    photoHeight: 480,
    photoPosition: "center 42%",
    padX: 60,
    barGap: 34,
    colGap: 40,
    leftWidth: 470,
    headline: 70,
    stroke: 2.1,
    lead: 22,
    leadGap: 20,
    item: 19,
    itemGap: 16,
    icon: 25,
    barBottom: 86,
    barHeight: 82,
    barText: 27,
    byline: 17,
    bylineBottom: 38,
  },
  "9x16": {
    photoHeight: 1000,
    photoPosition: "center 42%",
    padX: 64,
    barGap: 44,
    colGap: 46,
    leftWidth: 540,
    headline: 84,
    stroke: 2.6,
    lead: 27,
    leadGap: 26,
    item: 23,
    itemGap: 21,
    icon: 30,
    barBottom: 270,
    barHeight: 104,
    barText: 33,
    byline: 21,
    bylineBottom: 194,
  },
};

function makingMoreHtml(ratio) {
  const { width, height } = RATIOS[ratio];
  const s = makingMoreSizes[ratio];
  const rightWidth = width - s.padX * 2 - s.leftWidth - s.colGap;
  const tick = Math.round(s.icon * 0.5);

  const items = revenueGaps
    .map(
      (text) => `        <li style="display:flex;align-items:flex-start;gap:${Math.round(s.icon * 0.52)}px;list-style:none;">
          <span style="flex:none;width:${s.icon}px;height:${s.icon}px;margin-top:2px;border-radius:50%;border:1.5px solid rgba(255,255,255,.5);display:flex;align-items:center;justify-content:center;">
            <svg width="${tick}" height="${tick}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>
          </span>
          <span style="font-size:${s.item}px;line-height:1.34;font-weight:400;color:#c9c9c9;">${text}</span>
        </li>`
    )
    .join("\n");

  return page(
    width,
    height,
    `  <img src="../condo-bedroom.png" alt="" style="position:absolute;top:0;left:0;width:${width}px;height:${s.photoHeight}px;object-fit:cover;object-position:${s.photoPosition};">
  <div style="position:absolute;top:${s.photoHeight - 110}px;left:0;width:${width}px;height:110px;background:linear-gradient(to bottom,rgba(10,10,10,0),${INK});"></div>

  <section style="position:absolute;top:${s.photoHeight}px;left:${s.padX}px;right:${s.padX}px;bottom:${s.barBottom + s.barHeight + s.barGap}px;display:flex;gap:${s.colGap}px;align-items:center;">
    <h1 style="flex:none;width:${s.leftWidth}px;font-size:${s.headline}px;line-height:.92;font-weight:800;letter-spacing:-.035em;text-transform:uppercase;color:#fff;">
      Your Airbnb<br>Should Be<br>Making You<br><span style="display:inline-block;letter-spacing:.02em;color:transparent;-webkit-text-stroke:${s.stroke}px #fff;">More.</span>
    </h1>
    <div style="width:${rightWidth}px;">
      <div style="font-size:${s.lead}px;line-height:1.3;font-weight:700;color:#fff;margin-bottom:${s.leadGap}px;">Does this sound like you?</div>
      <ul style="display:flex;flex-direction:column;gap:${s.itemGap}px;">
${items}
      </ul>
    </div>
  </section>

  <div style="position:absolute;left:${s.padX}px;right:${s.padX}px;bottom:${s.barBottom}px;height:${s.barHeight}px;border:2px solid rgba(255,255,255,.85);border-radius:6px;display:flex;align-items:center;justify-content:center;">
    <div style="font-size:${s.barText}px;font-weight:700;letter-spacing:-.01em;color:#fff;">We Turn Hosts Into Hands-Off Earners.</div>
  </div>

  <div style="position:absolute;left:0;right:0;bottom:${s.bylineBottom}px;text-align:center;font-size:${s.byline}px;font-weight:400;letter-spacing:.06em;color:#6f6f6f;">By Mandel Realty Group</div>`,
    INK
  );
}

/* ------------------------------------------------------------------ */
/* v4 — On-Call 24/7 (late-night notification stack, navy + cyan)      */
/* ------------------------------------------------------------------ */

const notifications = [
  { who: "Guest", time: "11:47 PM", body: "The wifi password isn't working" },
  { who: "Guest", time: "2:14 AM", body: "How do I turn on the heat?" },
  { who: "Cleaner", time: "6:03 AM", body: "Can't make today's turnover, sorry" },
];

const onCallPains = [
  "Answering guest texts [[during dinner]]",
  "[[Losing sleep]] over bad reviews",
  "[[No real time off]], ever",
  "Wondering if it's [[even worth it]] anymore",
];

const onCallSizes = {
  "4x5": {
    padX: 64,
    padTop: 58,
    padBottom: 54,
    cards: 3,
    cardName: 23,
    cardTime: 20,
    cardMsg: 24,
    cardPadY: 22,
    cardPadX: 26,
    cardIcon: 46,
    cardRadius: 20,
    cardGap: 16,
    headline: 80,
    sub: 32,
    subGap: 26,
    item: 29,
    itemGap: 26,
    box: 46,
    kicker: 44,
    byline: 21,
  },
  "1x1": {
    padX: 60,
    padTop: 46,
    padBottom: 44,
    cards: 2,
    cardName: 20,
    cardTime: 18,
    cardMsg: 21,
    cardPadY: 18,
    cardPadX: 22,
    cardIcon: 40,
    cardRadius: 18,
    cardGap: 14,
    headline: 64,
    sub: 27,
    subGap: 20,
    item: 24,
    itemGap: 20,
    box: 40,
    kicker: 36,
    byline: 18,
  },
  "9x16": {
    padX: 64,
    padTop: 160,
    padBottom: 190,
    cards: 3,
    cardName: 25,
    cardTime: 22,
    cardMsg: 26,
    cardPadY: 24,
    cardPadX: 28,
    cardIcon: 50,
    cardRadius: 22,
    cardGap: 18,
    headline: 88,
    sub: 36,
    subGap: 28,
    item: 32,
    itemGap: 30,
    box: 52,
    kicker: 50,
    byline: 23,
  },
};

function onCallHtml(ratio) {
  const { width, height } = RATIOS[ratio];
  const s = onCallSizes[ratio];

  const cards = notifications
    .slice(0, s.cards)
    .map((n, i) => {
      const glyph = Math.round(s.cardIcon * 0.5);
      return `      <div style="opacity:${1 - i * 0.08};display:flex;align-items:center;gap:${Math.round(s.cardPadX * 0.7)}px;padding:${s.cardPadY}px ${s.cardPadX}px;border-radius:${s.cardRadius}px;background:rgba(9,36,50,.78);border:1px solid rgba(255,255,255,.11);box-shadow:0 18px 40px rgba(0,0,0,.45);">
        <span style="flex:none;width:${s.cardIcon}px;height:${s.cardIcon}px;border-radius:${Math.round(s.cardIcon * 0.3)}px;background:rgba(108,210,222,.14);border:1px solid rgba(108,210,222,.3);display:flex;align-items:center;justify-content:center;">
          <svg width="${glyph}" height="${glyph}" viewBox="0 0 24 24" fill="none" stroke="${CYAN}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.5-.7L3 21l1.8-5A8.3 8.3 0 0 1 4 11.5 8.4 8.4 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5Z"/></svg>
        </span>
        <span style="flex:1;min-width:0;">
          <span style="display:flex;align-items:baseline;justify-content:space-between;gap:16px;">
            <span style="font-size:${s.cardName}px;font-weight:600;color:#fff;">${n.who}</span>
            <span style="font-size:${s.cardTime}px;font-weight:600;color:${CYAN};">${n.time}</span>
          </span>
          <span style="display:block;margin-top:5px;font-size:${s.cardMsg}px;font-weight:400;color:#b6c7cf;">${n.body}</span>
        </span>
      </div>`;
    })
    .join("\n");

  const items = onCallPains
    .map(
      (text) => `        <li style="display:flex;align-items:flex-start;gap:${Math.round(s.box * 0.42)}px;list-style:none;">
          <span style="flex:none;width:${s.box}px;height:${s.box}px;border-radius:${Math.round(s.box * 0.28)}px;background:${CYAN};display:flex;align-items:center;justify-content:center;">
            <svg width="${Math.round(s.box * 0.56)}" height="${Math.round(s.box * 0.56)}" viewBox="0 0 24 24" fill="none" stroke="${NAVY}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6.5"/></svg>
          </span>
          <span style="font-size:${s.item}px;line-height:1.24;font-weight:600;color:#eef4f7;padding-top:${Math.round(s.box * 0.09)}px;">${highlight(text)}</span>
        </li>`
    )
    .join("\n");

  return page(
    width,
    height,
    `  <img src="../night-room.png" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 50%;opacity:.85;mask-image:linear-gradient(to bottom,#000 0%,#000 30%,transparent 76%);">
  <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(4,25,37,.32) 0%,rgba(4,25,37,.72) 42%,${NAVY} 78%);"></div>

  <div style="position:absolute;inset:0;padding:${s.padTop}px ${s.padX}px ${s.padBottom}px;display:flex;flex-direction:column;justify-content:space-between;">
    <section style="display:flex;flex-direction:column;gap:${s.cardGap}px;">
${cards}
    </section>

    <h1 style="text-align:center;font-size:${s.headline}px;line-height:1.04;font-weight:700;letter-spacing:-.03em;color:#fff;">
      You Didn't Sign Up<br>To Be <span style="color:${CYAN};">On-Call 24/7.</span>
    </h1>

    <section>
      <div style="font-size:${s.sub}px;font-weight:700;color:#fff;margin-bottom:${s.subGap}px;">Does this sound like you?</div>
      <ul style="display:flex;flex-direction:column;gap:${s.itemGap}px;">
${items}
      </ul>
    </section>

    <footer style="text-align:center;">
      <div style="font-size:${s.kicker}px;line-height:1.14;font-weight:700;letter-spacing:-.02em;color:#fff;">Turn Your <span style="color:${CYAN};">Airbnb</span> Into <span style="color:${CYAN};">Passive Income!</span></div>
      <div style="margin-top:${Math.round(s.byline * 0.7)}px;font-size:${s.byline}px;font-weight:500;color:rgba(255,255,255,.72);">By Mandel Realty Group</div>
    </footer>
  </div>`,
    NAVY
  );
}

/* ------------------------------------------------------------------ */

const creatives = [
  { slug: "v1-free-furnish", html: freeFurnishHtml },
  { slug: "v2-stop-self-managing", html: selfManagingHtml },
  { slug: "v3-making-you-more", html: makingMoreHtml },
  { slug: "v4-on-call", html: onCallHtml },
];

const only = process.argv.slice(2);
const queue = only.length
  ? creatives.filter((c) => only.includes(c.slug))
  : creatives;

if (queue.length === 0) {
  console.error(
    `No matching creative. Available: ${creatives.map((c) => c.slug).join(", ")}`
  );
  process.exit(1);
}

fs.mkdirSync(BUILD_DIR, { recursive: true });
console.log("Output folder:", UPLOAD_DIR);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
});

try {
  for (const creative of queue) {
    const outDir = path.join(UPLOAD_DIR, creative.slug);
    fs.mkdirSync(outDir, { recursive: true });

    for (const [ratio, size] of Object.entries(RATIOS)) {
      const htmlPath = path.join(BUILD_DIR, `${creative.slug}-${ratio}.html`);
      fs.writeFileSync(htmlPath, creative.html(ratio));

      const tab = await browser.newPage();
      await tab.setViewport({
        width: size.width,
        height: size.height,
        deviceScaleFactor: 2,
      });
      await tab.goto(`file://${htmlPath}`, { waitUntil: "networkidle0" });
      await tab.evaluateHandle("document.fonts.ready");
      await new Promise((resolve) => setTimeout(resolve, 350));
      await tab.screenshot({
        path: path.join(outDir, size.filename),
        type: "png",
        clip: { x: 0, y: 0, width: size.width, height: size.height },
      });
      await tab.close();
      console.log("Wrote", path.join(outDir, size.filename));
    }
  }
} finally {
  await browser.close();
}

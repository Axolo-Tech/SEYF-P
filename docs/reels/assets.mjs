// Logos en PNG (desde public/brand) y grabación del hero de la landing en vertical.
import { createRequire } from "module";
import fs from "fs";
import { execFileSync } from "child_process";
const require = createRequire(import.meta.url);
const { chromium } = require("/Users/gerryvela/node_modules/playwright-core");
const DIR = new URL(".", import.meta.url).pathname;
const BRAND = new URL("../../public/brand/", import.meta.url).pathname;
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--window-size=360,640", "--force-device-scale-factor=3", "--hide-scrollbars"] });

for (const [f, w] of [["seyf-symbol.svg", 900], ["seyf-horizontal-dark.svg", 1400], ["seyf-horizontal-light.svg", 1400]]) {
  const pg = await b.newPage({ viewport: { width: w, height: w }, deviceScaleFactor: 1 });
  await pg.setContent(`<html><body style="margin:0;background:transparent"><img id=i src="data:image/svg+xml;base64,${fs.readFileSync(BRAND + f).toString("base64")}" style="width:${w}px;display:block"></body></html>`);
  await pg.locator("#i").screenshot({ path: `${DIR}assets/${f.replace(".svg", ".png")}`, omitBackground: true });
  await pg.close();
}

// hero de la landing (tubo de espuma) en 1080x1920
const ctx = await b.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: "es-MX" });
await ctx.addInitScript(() => document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.appendChild(s); }));
const pg = await ctx.newPage();
await pg.goto("http://localhost:3210/", { waitUntil: "load", timeout: 180000 });
await pg.waitForTimeout(2000);
await pg.evaluate(() => sessionStorage.clear());
const tmp = fs.mkdtempSync("/tmp/seyfhero-");
const frames = [];
const cdp = await ctx.newCDPSession(pg);
cdp.on("Page.screencastFrame", async (ev) => {
  const f = `${tmp}/${String(frames.length).padStart(6, "0")}.jpg`;
  fs.writeFileSync(f, Buffer.from(ev.data, "base64")); frames.push([f, ev.metadata.timestamp]);
  await cdp.send("Page.screencastFrameAck", { sessionId: ev.sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1080, maxHeight: 1920 });
await pg.reload({ waitUntil: "domcontentloaded" });
await pg.waitForTimeout(7000);
await cdp.send("Page.stopScreencast");
await b.close();
const list = frames.map(([f, ts], i) => `file '${f}'\nduration ${((frames[i + 1]?.[1] ?? ts + 0.3) - ts).toFixed(4)}`).join("\n") + `\nfile '${frames.at(-1)[0]}'\n`;
fs.writeFileSync(`${tmp}/list.txt`, list);
execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", `${tmp}/list.txt`, "-vf", "fps=30,scale=1080:1920,format=yuv420p", "-c:v", "libx264", "-crf", "16", `${DIR}clips/landing_hero.mp4`]);
console.log("ok", frames.length);

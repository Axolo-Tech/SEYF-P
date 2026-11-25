// Graba flujos de la app (servidor demo SEYF_DEMO=1 en :3333) como clips verticales.
// CDP screencast → cuadros con marca de tiempo → mp4 a 30 fps. Uso: node record.mjs <flujo> [...]
import { createRequire } from "module";
import fs from "fs";
import { execFileSync } from "child_process";
import path from "path";
const require = createRequire(import.meta.url);
const { chromium } = require("/Users/gerryvela/node_modules/playwright-core");
const { installMocks, PK } = await import("./mocks.mjs");
const { OPTS } = await import("./fixtures.mjs");
const DIR = path.dirname(new URL(import.meta.url).pathname);

const TAP_JS = () => {
  const st = document.createElement("style");
  st.textContent = `nextjs-portal{display:none!important}
  .demo-tap{position:fixed;z-index:2147483647;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;pointer-events:none;
    background:rgba(255,255,255,.35);border:2px solid rgba(255,255,255,.85);animation:demotap .55s ease-out forwards}
  @keyframes demotap{from{transform:scale(.4);opacity:1}to{transform:scale(1.5);opacity:0}}`;
  document.head.appendChild(st);
  addEventListener("pointerdown", (e) => { const d = document.createElement("div"); d.className = "demo-tap"; d.style.left = e.clientX + "px"; d.style.top = e.clientY + "px"; document.body.appendChild(d); setTimeout(() => d.remove(), 700); }, true);
};

export async function record(name, steps, { lang = "es" } = {}) {
  const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--window-size=390,844", "--force-device-scale-factor=3", "--hide-scrollbars", "--force-color-profile=srgb"] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: lang === "en" ? "en-US" : "es-MX" });
  await ctx.addInitScript((pk) => {
    try { sessionStorage.setItem("seyf_auth_token", JSON.stringify({ token: "demo", account: pk, expiresAt: Date.now() + 1e9 })); } catch {}
  }, PK);
  await ctx.addInitScript(`document.addEventListener("DOMContentLoaded", ${TAP_JS.toString()})`);
  await installMocks(ctx);
  const pg = await ctx.newPage();
  await pg.goto("http://localhost:3333/app", { waitUntil: "domcontentloaded", timeout: 180000 });
  await pg.waitForTimeout(5000); // datos cargados antes de grabar

  const tmp = fs.mkdtempSync(`/tmp/seyfrec-${name}-`);
  const frames = [];
  const cdp = await ctx.newCDPSession(pg);
  cdp.on("Page.screencastFrame", async (ev) => {
    const f = `${tmp}/${String(frames.length).padStart(6, "0")}.jpg`;
    fs.writeFileSync(f, Buffer.from(ev.data, "base64"));
    frames.push([f, ev.metadata.timestamp]);
    await cdp.send("Page.screencastFrameAck", { sessionId: ev.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1170, maxHeight: 2532, everyNthFrame: 1 });
  await pg.waitForTimeout(600);
  const t0 = Date.now();
  const marks = [];
  for (const s of steps) { try {
    if (s.mark) marks.push([s.mark, (Date.now() - t0) / 1000]);
    if (s.tab) await pg.locator(`.tabbar .tab:nth-child(${s.tab})`).click();
    if (s.click) await pg.getByText(s.click, { exact: !!s.exact }).first().click({ timeout: 8000 });
    if (s.sel) await pg.locator(s.sel).first().click({ timeout: 8000 });
    if (s.fill) { await pg.locator(s.fill[0]).first().click(); await pg.keyboard.type(s.fill[1], { delay: 90 }); }
    if (s.type) await pg.keyboard.type(s.type, { delay: 110 });
    if (s.scroll) await pg.evaluate(([y, ms]) => new Promise((res) => {
      const el = [...document.querySelectorAll(".screen, .modal-sheet")].reverse().find((e) => e.scrollHeight > e.clientHeight) || document.scrollingElement;
      const from = el.scrollTop, t = performance.now(); const ease = (p) => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
      const step = (n) => { const p = Math.min(1, (n - t) / ms); el.scrollTop = from + y * ease(p); p < 1 ? requestAnimationFrame(step) : res(); };
      requestAnimationFrame(step);
    }), [s.scroll, s.ms ?? 900]);
    if (s.drag) { const box = await pg.locator(s.drag[0]).first().boundingBox(); const y = box.y + box.height / 2;
      await pg.mouse.move(box.x + 4, y); await pg.mouse.down();
      for (let i = 1; i <= 30; i++) { await pg.mouse.move(box.x + 4 + (box.width * s.drag[1] * i) / 30, y); await pg.waitForTimeout(25); }
      await pg.mouse.up(); }
    if (s.js) await pg.evaluate(s.js);
    // desliza un <input type=range> con eventos reales de React
    if (s.range) await pg.evaluate(([sel, to, ms]) => new Promise((res) => {
      const el = document.querySelector(sel); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      const from = Number(el.value), t = performance.now(); const ease = (p) => (p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
      const step = (n) => { const p = Math.min(1, (n - t) / ms); set.call(el, String(Math.round(from + (to - from) * ease(p)))); el.dispatchEvent(new Event("input", { bubbles: true }));
        p < 1 ? requestAnimationFrame(step) : res(); };
      requestAnimationFrame(step);
    }), s.range);
    await pg.waitForTimeout(s.wait ?? 1200);
  } catch (e) { await pg.screenshot({ path: `${DIR}/clips/${name}.err.png` }); await b.close(); throw e; } }
  await cdp.send("Page.stopScreencast");
  await b.close();
  // concat con duraciones reales → 30 fps constantes
  const list = frames.map(([f, ts], i) => `file '${f}'\nduration ${((frames[i + 1]?.[1] ?? ts + 0.5) - ts).toFixed(4)}`).join("\n") + `\nfile '${frames.at(-1)[0]}'\n`;
  fs.writeFileSync(`${tmp}/list.txt`, list);
  const out = `${DIR}/clips/${name}.mp4`;
  execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", `${tmp}/list.txt`, "-vf", "fps=30,scale=1080:-2:flags=lanczos,format=yuv420p",
    "-c:v", "libx264", "-preset", "slow", "-crf", "16", out]);
  fs.writeFileSync(`${DIR}/clips/${name}.marks.json`, JSON.stringify(marks));
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(out, frames.length, "frames");
}

const FLOWS = (await import("./flows.mjs")).FLOWS;
for (const n of process.argv.slice(2)) {
  const f = FLOWS[n];
  OPTS.vaults = f.vaults ?? "full";
  await record(n, f.steps ?? f);
}

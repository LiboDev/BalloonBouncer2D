const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function playwright() {
  try { return require('playwright'); } catch {}
  const base = path.join(os.homedir(), 'AppData', 'Local', 'npm-cache', '_npx');
  for (const entry of fs.readdirSync(base)) {
    const p = path.join(base, entry, 'node_modules', 'playwright');
    if (fs.existsSync(p)) return require(p);
  }
  throw Error('Playwright is required to render the game wordmark.');
}

(async () => {
  const browser = await playwright().chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1300, height: 600 }, deviceScaleFactor: 2 });
    await page.setContent(`<!doctype html><html><head><style>
      * { box-sizing: border-box; }
      html, body { margin: 0; background: transparent; }
      h1 { display: inline-block; margin: 0; padding: 55px 80px 75px;
        font: 1000 180px/.86 "Nunito", "Segoe UI Rounded", "Arial Rounded MT Bold", system-ui, sans-serif;
        letter-spacing: -7px; text-align: center; color: #ffe066;
        -webkit-text-stroke: 3px #a74417;
        text-shadow: 0 10px 0 #f27013, 0 18px 0 #9b3b12, 0 26px 16px #27184d77;
      }
    </style></head><body><h1>Balloon<br>Bouncer</h1></body></html>`);
    await page.locator('h1').screenshot({ path: path.join(__dirname, 'raw', 'logo.png'), omitBackground: true });
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

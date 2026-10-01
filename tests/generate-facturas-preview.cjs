const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:2});
    await page.route('**/assets/brand/facturas.svg', route => route.fulfill({contentType:'image/svg+xml',body:fs.readFileSync(path.join(__dirname,'../marketing/app_landings_demo/assets/brand/facturas.svg'))}));
    await page.goto('file:///'+path.join(__dirname,'../marketing/app_landings_demo/ocr-facturas.html').replaceAll('\\','/'));
    await page.addStyleTag({content:'.phone{visibility:hidden}'});
    await page.locator('#dashboardPreview').screenshot({path:path.join(__dirname,'../marketing/app_landings_demo/assets/landing/facturas-dashboard.png')});
    await page.addStyleTag({content:'.phone{visibility:visible}'});
    await page.locator('#mobilePreview').screenshot({path:path.join(__dirname,'../marketing/app_landings_demo/assets/landing/facturas-mobile.png')});
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });

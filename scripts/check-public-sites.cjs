const { chromium } = require('/tmp/sobytie-public-check/node_modules/playwright');
const fs = require('node:fs');
const out = 'output/playwright';
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader'] });
  const results = [];
  for (const [name, url] of [
    ['sobytie', 'https://sobytie.aram-sites.duckdns.org/'],
    ['tate', 'https://tate.aram-sites.duckdns.org/'],
    ['sobytie-github', 'https://arammuradian01-cloud.github.io/sobytie-apartment-studio/'],
  ]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const result = { name, url, errors: [], failedRequests: [], authenticatedRequests: [], responses: [], captureWarnings: [] };
    const capture = async suffix => {
      try { await page.screenshot({ path: `${out}/${name}-${suffix}.png`, timeout: 8000 }); }
      catch (error) { result.captureWarnings.push({ suffix, error: error.message }); }
    };
    page.on('pageerror', error => result.errors.push(error.message));
    page.on('requestfailed', request => result.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
    page.on('request', request => {
      const headers = request.headers();
      if (headers.authorization || headers.cookie) result.authenticatedRequests.push(request.url());
    });
    page.on('response', response => result.responses.push({ url: response.url(), status: response.status() }));
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      result.httpStatus = response.status();
      if (response.status() !== 200) throw new Error(`HTTP ${response.status()}`);
      await page.waitForFunction(() => window.sobytie?.state.loaded || window.tateDiagnostics?.getState().loaded, null, { timeout: 60000 });
      result.title = await page.title();
      result.loaded = await page.evaluate(() => window.sobytie ? { ...window.sobytie.diagnostics(), objects: window.sobytie.diagnostics().objects.length } : window.tateDiagnostics.getState());
      result.cookies = (await context.cookies()).length;
      result.passwordFields = await page.locator('input[type="password"]').count();
      if (name.startsWith('sobytie')) {
        if (result.loaded.exterior.revision !== 'E03' || !result.loaded.exterior.photo.loaded) throw new Error('E03 panorama missing');
        const layout = await page.evaluate(async () => (await fetch(new URL('project/project.json?v=T05E03',location.href))).json());
        if (Object.values(layout.variants).some(v => v.objects.some(o => o.id === 'H2'))) throw new Error('Corridor bench still present');
        await page.evaluate(() => window.sobytie.selectRoom('corridor'));
        const beforeClick = await page.evaluate(() => window.sobytie.diagnostics().camera);
        const box = await page.locator('#scene').boundingBox();
        await page.locator('#scene').click({ position: { x: box.width * .5, y: box.height * .78 } });
        await page.waitForFunction(before => Math.hypot(...window.sobytie.diagnostics().camera.map((v,i)=>v-before[i])) > .1, beforeClick, { timeout: 15000 });
        result.clickWalk = await page.evaluate(() => ({...window.sobytie.diagnostics().walk,blocked:window.sobytie.diagnostics().blocked}));
        if (result.clickWalk.blocked) throw new Error('Click walk entered obstacle');
        await page.evaluate(() => window.sobytie.stopWalking());
        await page.evaluate(() => { window.sobytie.selectRoom('lower'); window.sobytie.setMode('gallery'); });
        await page.locator('#interior-image').evaluate(image => image.decode());
        result.interior = await page.locator('#interior-image').evaluate(image => ({ src: image.currentSrc, width: image.naturalWidth }));
        await capture('interior');
        await page.evaluate(() => { window.sobytie.setMode('walk'); window.sobytie.setSun('2029-06-21', 1020); window.sobytie.windowView(); });
      }
      await page.setViewportSize({ width: 390, height: 844 });
      result.horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      await capture('mobile');
      result.ok = !result.errors.length && !result.failedRequests.length && !result.authenticatedRequests.length && !result.passwordFields && !result.horizontalOverflow && !result.responses.some(r => r.status >= 400);
    } catch (error) {
      result.ok = false;
      result.error = error.message;
      await capture('failure');
    }
    results.push(result);
    console.log(JSON.stringify({ name, ok: result.ok, httpStatus: result.httpStatus, error: result.error, failedRequests: result.failedRequests, authenticatedRequests: result.authenticatedRequests }));
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  if (results.some(result => !result.ok)) process.exitCode = 1;
})();

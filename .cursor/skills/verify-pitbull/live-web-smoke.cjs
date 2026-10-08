// Read-only Playwright UI smoke for verify-pitbull (one fresh browser context per feature; no clicks that mutate data).
// Usage (from C:\pitbull-private\e2e so @playwright/test resolves):
//   node ..\.cursor\skills\verify-pitbull\live-web-smoke.cjs <Prefix> <Ts> [billing-applications.json from live-api-smoke.ps1]
// Writes <Prefix>-<Ts>-<feature>-*.png and <Prefix>-<Ts>-web-ui.json under evidence\. Requires web on WEB_URL (default :3000) and API on :5081.
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', '..', 'e2e', 'node_modules', '@playwright', 'test'));
const fs = require('fs');
const PREFIX = process.argv[2] || 'verify';
const TS = process.argv[3] || new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const EV = path.join(__dirname, 'evidence').replace(/\\/g, '/');
const WEB = process.env.WEB_URL || 'http://localhost:3000';
const PW = 'PitbullDemo2026!';
let billingAppId = process.env.BILLING_APP_ID || null;
if (!billingAppId && process.argv[4]) { try { billingAppId = JSON.parse(fs.readFileSync(process.argv[4], 'utf8').replace(/^\uFEFF/, '')).items[0].id; } catch (e) { console.error('could not read billing app id: ' + e); } }
const ids = { billingAppId }; const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';const plan = [
  { feature: 'login-explore-as-role', email: 'ceo@demo.local', routes: [] },
  { feature: 'projects-workspace', email: 'pm@demo.local', routes: ['/projects', { clickFrom: '/projects', hrefRe: '^/projects/' + UUID + '$', save: 'projectId' }] },
  { feature: 'time-tracking', email: 'pm@demo.local', routes: ['/time-tracking', '/time-tracking/approval'] },
  { feature: 'contracts-aia-billing', email: 'ceo@demo.local', routes: ['/billing/contracts', '/billing/applications', { fromSaved: 'billingAppId', tmpl: '/billing/applications/{id}' }, '/contracts'] },
  { feature: 'daily-reports-field', email: 'superintendent@demo.local', routes: ['/daily-reports/mobile', { clickFrom: '/projects', hrefRe: '^/projects/' + UUID + '$', save: 'fieldProjectId' }, { fromSaved: 'fieldProjectId', tmpl: '/projects/{id}/daily-reports' }] },
  { feature: 'payroll-runs-union-certified', email: 'mgr-payroll@demo.local', routes: ['/payroll/runs', { clickFrom: '/payroll/runs', hrefRe: '^/payroll/runs/' + UUID + '$', save: 'runId' }, '/payroll/certified', '/payroll/reviews', '/admin/pay-periods'] },
];
(async () => {
  const browser = await chromium.launch();
  const out = [];
  for (const step of plan) {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await ctx.newPage();
    const apiFails = []; const consoleErrors = [];
    page.on('response', r => { const u = r.url(); if (u.includes('/api/') && r.status() >= 400) apiFails.push(`${r.status()} ${r.request().method()} ${u.replace(/^https?:\/\/[^/]+/, '')}`); });
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
    const rec = { feature: step.feature, email: step.email, pages: [] };
    if (process.env.FEATURE && process.env.FEATURE !== step.feature) { await ctx.close(); continue; }
    try {
      await page.goto(WEB + '/login');
      if (step.feature === 'login-explore-as-role') {
        const roleBtn = page.getByRole('button', { name: /^CEO\b/ }).first();
        await roleBtn.waitFor({ state: 'visible', timeout: 30000 });
        rec.demoRoleButtons = (await page.getByRole('button').allTextContents()).map(s => s.trim().slice(0, 60)).filter(Boolean);
        await page.screenshot({ path: `${EV}/${PREFIX}-${TS}-login-explore-as-role-login-page.png` });
        rec.entry = 'demo role button: CEO';
        const demoResp = page.waitForResponse(r => r.url().includes('/api/auth/demo-role-login'), { timeout: 30000 }).catch(() => null);
        await roleBtn.click();
        const dr = await demoResp;
        rec.demoRoleLoginStatus = dr ? dr.status() : null;
        if (dr && dr.status() === 429) {
          // 'demo-register' limiter: 10/hour per client IP. Record it, then prove the same persona via the email form.
          rec.entry = 'demo role button: CEO -> 429 RATE_LIMITED; fallback email form';
          await page.getByRole('button', { name: /or sign in with email/i }).click({ timeout: 2000 }).catch(() => {}); // inert on desktop widths
          await page.getByRole('textbox', { name: /email address/i }).fill(step.email);
          await page.getByRole('textbox', { name: /password/i }).fill(PW);
          await page.getByRole('button', { name: /^sign in$/i }).click();
        }
      } else {
        const btn = page.getByRole('button', { name: /^sign in$/i });
        await btn.waitFor({ state: 'visible', timeout: 30000 });
        await page.getByRole('textbox', { name: /email address/i }).fill(step.email);
        await page.getByRole('textbox', { name: /password/i }).fill(PW);
        rec.entry = 'email form';
        await btn.click();
      }
      await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      rec.landing = new URL(page.url()).pathname;
      if (step.feature === 'login-explore-as-role') {
        const h = await page.locator('h1').first().textContent({ timeout: 10000 }).catch(() => null);
        const lt = await page.evaluate(() => (document.querySelector('main') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 300)).catch(() => null); rec.pages.push({ route: '/login -> landing', finalPath: rec.landing, mainText: lt });
        await page.screenshot({ path: `${EV}/${PREFIX}-${TS}-login-explore-as-role-landing.png` });
      }
      for (let route of step.routes) {
        let resp = null;
        if (typeof route === 'object' && route.clickFrom) {
          await page.goto(WEB + route.clickFrom, { timeout: 60000 });
          await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
          const re = new RegExp(route.hrefRe);
          const hrefs = await page.$$eval('a[href]', as => as.map(a => a.getAttribute('href')));
          const href = hrefs.find(h => h && re.test(h.split('?')[0]));
          if (!href) { rec.pages.push({ route: route.clickFrom + ' (click first detail link)', error: 'no matching link visible', hrefSample: hrefs.slice(0, 15) }); continue; }
          resp = await page.goto(WEB + href, { timeout: 60000 });
          await page.waitForURL(u => u.pathname === href.split('?')[0], { timeout: 30000 }).catch(() => {});
          ids[route.save] = href.split('/').pop();
          route = href + ' (link href from ' + route.clickFrom + ' list)';
        } else {
          if (typeof route === 'object' && route.fromSaved) { if (!ids[route.fromSaved]) { rec.pages.push({ route: route.tmpl, error: 'no saved id' }); continue; } route = route.tmpl.replace('{id}', ids[route.fromSaved]); }
          resp = await page.goto(WEB + route, { timeout: 60000 });
        }
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
        const h = await page.locator('main h1, main h2').first().textContent({ timeout: 10000 }).catch(() => null);
        const mainText = await page.evaluate(() => (document.querySelector('main') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 300)).catch(() => null);
        const errText = await page.getByText(/something went wrong|failed to load|access denied|not found/i).first().textContent({ timeout: 1000 }).catch(() => null);
        const slug = route.split(' ')[0].replace(/^\//, '').replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, 'id').replace(/\//g, '_');
        const shot = `${EV}/${PREFIX}-${TS}-${step.feature}-${slug}.png`;
        await page.screenshot({ path: shot });
        rec.pages.push({ route, httpStatus: resp ? resp.status() : 'client-nav', finalPath: new URL(page.url()).pathname, heading: h && h.trim(), mainText, errText: errText && errText.trim().slice(0, 160), screenshot: shot.split('/').pop() });
      }
    } catch (e) { rec.error = String(e).slice(0, 400); await page.screenshot({ path: `${EV}/${PREFIX}-${TS}-${step.feature}-error.png` }).catch(() => {}); }
    rec.apiFails = [...new Set(apiFails)]; rec.consoleErrors = consoleErrors.slice(0, 8);
    out.push(rec);
    await ctx.close();
  }
  await browser.close();
  fs.writeFileSync(`${EV}/${PREFIX}-${TS}-web-ui.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
})();




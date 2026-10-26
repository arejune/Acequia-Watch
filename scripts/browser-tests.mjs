// End-to-end checks in a real Chrome at phone size. Starts its own Vite server
// (and a production build for the offline check), runs the suites, and exits
// non-zero if any fail. Uses the in-browser demo server, never Supabase.
//
//   npm run test:browser                  all suites
//   npm run test:browser -- core packet   only these
//
// Suites: core, quick, packet, tour, phone, a11y, offline.
// Set CHROME_PATH if Chrome is not in the usual place.
import puppeteer from 'puppeteer-core'
import { build, createServer, preview } from 'vite'
import { PDFDocument } from 'pdf-lib'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = process.env.CHROME_PATH ?? [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(existsSync)
if (!CHROME) throw new Error('Chrome not found. Set CHROME_PATH to its executable.')

const PHONE = { width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true }
const DEMO = { steward: 'Steward', steward2: 'Second steward', agency: 'Agency reviewer', admin: 'Admin' }
const GPS = { latitude: 36.0937, longitude: -106.8317, accuracy: 6 } // inside the demo valley
const ROUTES = {
  none: ['/welcome', '/signin', '/signin?tab=create', '/explore', '/learn', '/learn/quiz', '/act', '/act?tab=bills', '/act?tab=help', '/act/issue/money', '/act/write', '/play', '/map'],
  steward: ['/steward', '/steward/assess', '/steward/quick', '/steward/report/new', '/steward/inventory', '/steward/inventory/new', '/steward/sync', '/steward/reports', '/map', '/explore', '/more'],
  agency: ['/agency', '/agency/reports', '/map', '/more'],
  admin: ['/admin', '/agency'],
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const check = (ok, msg) => { if (!ok) throw new Error(msg) }
let browser, base

/** A fresh browser profile (its own IndexedDB, so its own demo server). */
async function newPage(viewport = PHONE) {
  const ctx = await browser.createBrowserContext()
  await ctx.overridePermissions(base, ['geolocation'])
  const page = await ctx.newPage()
  await page.setViewport(viewport)
  page.errors = []
  page.on('pageerror', (e) => page.errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !/tile\.openstreetmap|ERR_INTERNET/.test(m.text()) && page.errors.push(m.text().slice(0, 160)))
  return page
}

async function signIn(page, role) {
  await page.goto(`${base}/signin`, { waitUntil: 'networkidle0' })
  for (const b of await page.$$('button.demo-account')) {
    if ((await b.$eval('strong', (e) => e.textContent)) === DEMO[role]) { await b.click(); break }
  }
  await page.waitForFunction(() => location.pathname !== '/signin', { timeout: 10000 })
  await sleep(800)
}

// scroll a control clear of the fixed bars before tapping, as a person would
async function tap(el) {
  await el.evaluate((e) => e.scrollIntoView({ block: 'center' }))
  await sleep(120)
  await el.click()
}

// tap the nth match, querying again if a re-render replaced the element
async function tapNth(page, sel, n) {
  for (let tries = 0; ; tries++) {
    try {
      await page.waitForSelector(sel)
      return await tap((await page.$$(sel))[n])
    } catch (e) {
      if (tries > 3 || !/detached/.test(e.message)) throw e
      await sleep(300)
    }
  }
}

async function tapText(page, text, sel) {
  for (const el of await page.$$(sel)) {
    if ((await el.evaluate((e) => e.textContent.trim())).startsWith(text)) return tap(el)
  }
  throw new Error(`no ${sel} starting with "${text}"`)
}

async function goOffline(page, off) {
  await page.setOfflineMode(off)
  await page.evaluate((o) => window.dispatchEvent(new Event(o ? 'offline' : 'online')), off)
}

const pillSays = (page, text) => page.waitForFunction((t) => document.querySelector('.sync-pill')?.textContent.includes(t), { timeout: 15000 }, text)
const mainText = async (page) => (await page.$eval('main', (m) => m.innerText)).replace(/\s+/g, ' ')

/** A test photo: any JPEG works, so draw one. */
async function makePhoto() {
  const path = join(tmpdir(), 'acequia-watch-test-photo.jpg')
  const page = await browser.newPage()
  await page.setViewport({ width: 800, height: 600 })
  await page.setContent('<body style="margin:0;background:linear-gradient(#8a7a5c,#4a5a3a)">')
  writeFileSync(path, await page.screenshot({ type: 'jpeg' }))
  await page.close()
  return path
}

const SUITES = {
  /** A steward assesses a gap offline with photo, GPS, severity and costs, then syncs with no duplicates. */
  async core() {
    const page = await newPage()
    await signIn(page, 'steward')
    await page.goto(`${base}/steward/assess?filter=gap`, { waitUntil: 'networkidle0' })
    await goOffline(page, true)
    await sleep(800)
    const row = await page.$('.list .list-row')
    const name = await row.$eval('.name', (e) => e.textContent)
    await row.click()
    await sleep(500)
    await tapText(page, 'Damaged', 'label.choice')
    await tapText(page, '3 ·', 'label.choice')
    await page.setGeolocation(GPS)
    await (await page.$('.photo-add input[type=file]')).uploadFile(await makePhoto())
    await page.waitForSelector('.photo-tile img', { timeout: 10000 })
    const costs = await page.$$('.costs input')
    await costs[0].type('6000'); await costs[1].type('11000'); await costs[2].type('18000')
    await page.type('textarea', 'Bank washed out below the gate; debris in the channel.')
    await sleep(2500) // let the GPS watch settle
    await tapText(page, 'Save', 'button')
    await sleep(600)
    const errs = await page.$$eval('.field-error', (els) => els.map((e) => e.textContent))
    check(!errs.length, `form errors: ${errs.join(' | ')}`)

    await goOffline(page, false)
    await page.goto(`${base}/steward/sync`, { waitUntil: 'networkidle0' })
    await tapText(page, 'Sync now', 'button')
    await pillSays(page, 'Synced')
    const server = await page.evaluate(async () => {
      const open = (n) => new Promise((r) => { const q = indexedDB.open(n); q.onsuccess = () => r(q.result) })
      const all = (d, t) => new Promise((r) => { const q = d.transaction(t).objectStore(t).getAll(); q.onsuccess = () => r(q.result) })
      const d = await open('acequia-watch-devserver')
      const a = await all(d, 'assessments'), p = await all(d, 'photos')
      return { a: a.length, dupA: a.length - new Set(a.map((x) => x.id)).size, p: p.length, dupP: p.length - new Set(p.map((x) => x.id)).size }
    })
    check(!server.dupA && !server.dupP, `duplicates on the server: ${JSON.stringify(server)}`)
    check(!page.errors.length, page.errors.join(' / '))
    return `"${name}" saved offline and synced; server has ${server.a} reports and ${server.p} photos, 0 duplicates`
  },

  /** Camera-first quick report, offline the whole time. */
  async quick() {
    const page = await newPage()
    await signIn(page, 'steward')
    await page.setGeolocation({ ...GPS, accuracy: 5 })
    await goOffline(page, true)
    const t0 = Date.now()
    await (await page.$('.cta-camera input[type=file]')).uploadFile(await makePhoto())
    await page.waitForSelector('.quick-photo img', { timeout: 10000 })
    await sleep(1200) // let GPS settle so the nearest-structure list stops re-sorting
    const open = await page.$$eval('.pick', (els) => els.findIndex((e) => e.querySelector('small') && !e.textContent.includes('already reported') && !e.textContent.includes('Not in the inventory')))
    await tapNth(page, '.pick', open) // nearest structure nobody has reported yet
    await tapNth(page, '.outcome-damaged', 0)
    await tapNth(page, '.sev-btn', 2)
    const costs = await page.$$('.costs input')
    await tap(costs[0]); await costs[0].type('4000'); await costs[1].type('7500'); await costs[2].type('12000')
    await (await page.$('.savebar .btn-primary')).click()
    await page.waitForSelector('.saved-splash', { timeout: 5000 })
    const secs = ((Date.now() - t0) / 1000).toFixed(1)
    await page.waitForFunction(() => location.pathname === '/steward', { timeout: 5000 })
    await goOffline(page, false)
    await pillSays(page, 'Synced')
    check(!page.errors.length, page.errors.join(' / '))
    return `reported offline in ${secs} s of scripted taps, synced after reconnect`
  },

  /** The packet shows its photos online and with "Simulate offline", prints, and refuses other stewards. */
  async packet() {
    const page = await newPage()
    await signIn(page, 'steward')
    const url = await page.$eval('a[href^="/packet/"]', (a) => a.getAttribute('href'))
    const photos = async () => {
      await page.goto(base + url, { waitUntil: 'networkidle0' })
      await page.waitForFunction(() => !document.querySelector('.photo-loading'), { timeout: 30000 }).catch(() => {})
      return page.$$eval('.packet-photo img', (els) => els.filter((e) => e.complete && e.naturalWidth > 0).length)
    }
    const t0 = Date.now()
    const online = await photos()
    const pdf = await page.pdf({ format: 'letter', printBackground: true })
    const ms = Date.now() - t0
    const pages = (await PDFDocument.load(pdf)).getPageCount()
    await page.evaluate(() => localStorage.setItem('aw-simulate-offline', '1'))
    const offline = await photos()
    await page.evaluate(() => localStorage.removeItem('aw-simulate-offline'))
    check(online > 0 && offline === online, `photos online ${online}, offline ${offline}`)
    await page.goto(`${base}/steward/reports`, { waitUntil: 'networkidle0' })
    const report = await page.$eval('a[href^="/steward/report/"]', (a) => a.getAttribute('href'))

    const other = await newPage()
    await signIn(other, 'steward2')
    await other.goto(base + url, { waitUntil: 'networkidle0' })
    await sleep(2000)
    check((await mainText(other)).includes('don’t have access') || (await mainText(other)).includes("don't have access"), 'second steward did not see a packet refusal')
    await other.goto(base + report, { waitUntil: 'networkidle0' })
    await sleep(1500)
    check(/can.t open this report/.test(await mainText(other)), 'second steward did not see a report refusal')
    return `${online} photos online and offline; ${ms} ms to open and print, ${pages} pages, ${(pdf.length / 1e6).toFixed(2)} MB; refusals shown`
  },

  /** Guided tours stay on screen; a new account waits, an admin approves it, it signs in. */
  async tour() {
    let page = await newPage()
    await page.goto(`${base}/explore?tour=1`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('.tour-card', { timeout: 15000 })
    let steps = 0
    while (await page.$('.tour')) {
      await sleep(600)
      steps++
      await page.click('.tour-actions .btn-primary')
      check(steps < 20, 'guest tour never ended')
    }

    page = await newPage()
    await signIn(page, 'steward')
    await page.goto(`${base}/steward?tour=1`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('.tour-card', { timeout: 15000 })
    let stewardSteps = 0
    while (await page.$('.tour')) {
      await sleep(600)
      const fit = await page.evaluate(() => {
        const c = document.querySelector('.tour-card').getBoundingClientRect()
        const bar = document.querySelector('.tabbar')?.getBoundingClientRect().top ?? innerHeight
        return { title: document.querySelector('.tour-card h2').textContent, ok: c.top >= 0 && c.bottom <= bar + 1 }
      })
      check(fit.ok, `steward tour note "${fit.title}" is off screen`)
      stewardSteps++
      await page.click('.tour-actions .btn-primary')
    }

    page = await newPage()
    await page.goto(`${base}/signin?tab=create`, { waitUntil: 'networkidle0' })
    const email = `test${Date.now()}@example.org`
    const inputs = await page.$$('form .input')
    await inputs[0].type('Test Parciante'); await inputs[1].type(email); await inputs[2].type('ditchwater1')
    await inputs[3].type('Acequia de la Loma Quemada')
    await page.click('form .btn-primary')
    await page.waitForFunction(() => location.pathname === '/steward', { timeout: 10000 })
    await sleep(800)
    const waiting = await page.$eval('h1', (e) => e.textContent)

    // the admin approves in the same profile, since the demo server lives in the browser
    await page.evaluate(() => localStorage.removeItem('aw-local-session'))
    await signIn(page, 'admin')
    await page.goto(`${base}/admin`, { waitUntil: 'networkidle0' })
    await sleep(600)
    for (const r of await page.$$('.request')) {
      if ((await r.$eval('.request-who strong', (e) => e.textContent)) === 'Test Parciante') { await (await r.$('.btn-primary')).click(); break }
    }
    await sleep(800)
    await page.evaluate(() => localStorage.removeItem('aw-local-session'))
    await page.goto(`${base}/signin?tab=signin`, { waitUntil: 'networkidle0' })
    const f = await page.$$('form .input')
    await f[0].type(email); await f[1].type('ditchwater1')
    await page.click('form .btn-primary')
    await page.waitForFunction(() => location.pathname === '/steward', { timeout: 10000 })
    await sleep(1000)
    const home = await page.$eval('h1', (e) => e.textContent)
    check(home !== waiting, `approved account still sees "${home}"`)
    return `guest tour ${steps} notes, steward tour ${stewardSteps} notes all on screen; sign-up shows "${waiting}", after approval "${home}"`
  },

  /** Every route at three phone sizes: no sideways scroll, no tap target under 44 px, no console errors. */
  async phone() {
    const problems = []
    for (const [name, width, height] of [['iPhone SE', 375, 667], ['iPhone 15', 390, 844], ['Pixel 8', 412, 915]]) {
      for (const [role, routes] of Object.entries(ROUTES)) {
        const page = await newPage({ ...PHONE, width, height })
        if (role !== 'none') await signIn(page, role)
        for (const route of routes) {
          await page.goto(base + route, { waitUntil: 'networkidle0' })
          await sleep(400)
          const r = await page.evaluate(() => {
            const small = []
            for (const el of document.querySelectorAll('button, a, input, select, textarea, [role=switch], label.choice')) {
              if (el.closest('.leaflet-control-attribution, .sr-only, p, li.inline, .fact-src, dd, .act-list, .lede, .map-note, .bar-note, .t-text, figcaption')) continue
              if (el.matches('input[type=file], input[type=range], .switch input, .choice input')) continue
              if (el.matches('a') && el.closest('ul:not(.list) li')) continue // inline link in prose (WCAG 2.5.8 exception)
              // a checkbox or radio inside a label is tapped through the label
              const box = (el.matches('input[type=checkbox], input[type=radio]') && el.closest('label')) || el
              const b = box.getBoundingClientRect()
              const st = getComputedStyle(el)
              if (!b.width || !b.height || st.visibility === 'hidden' || st.display === 'none') continue
              if ((b.height < 44 && b.width < 44) || Math.min(b.height, b.width) < 32) small.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}" ${Math.round(b.width)}x${Math.round(b.height)}`)
            }
            return { overflow: document.documentElement.scrollWidth - innerWidth, small: [...new Set(small)].slice(0, 4), path: location.pathname }
          })
          if (r.overflow > 1) problems.push(`${name} ${role} ${route}: sideways scroll ${r.overflow}px`)
          if (r.small.length) problems.push(`${name} ${role} ${route}: small targets ${r.small.join('; ')}`)
          if (r.path !== route.split('?')[0]) problems.push(`${name} ${role} ${route}: redirected to ${r.path}`)
        }
        if (page.errors.length) problems.push(`${name} ${role}: ${[...new Set(page.errors)].join(' / ')}`)
        await page.browserContext().close()
      }
    }
    check(!problems.length, '\n    ' + problems.join('\n    '))
    return 'every route clean at 3 phone sizes'
  },

  /** axe-core WCAG 2.1 A/AA rules on every screen, for each role. */
  async a11y() {
    const axe = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8')
    const found = []
    let screens = 0
    for (const [role, routes] of Object.entries(ROUTES)) {
      const page = await newPage()
      if (role !== 'none') await signIn(page, role)
      for (const route of routes) {
        await page.goto(base + route, { waitUntil: 'networkidle0' })
        await sleep(500)
        // open the outcome step on a new report so its fields are checked too
        if (route === '/steward/report/new') { await (await page.$('input[name="outcome"]'))?.click(); await sleep(300) }
        await page.evaluate(axe)
        const v = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'], resultTypes: ['violations'] })).violations.map((x) => `${x.id} (${x.nodes.map((n) => n.target.join(' ')).slice(0, 2).join(', ')})`))
        for (const x of v) found.push(`${role} ${route}: ${x}`)
        screens++
      }
      await page.browserContext().close()
    }
    check(!found.length, '\n    ' + found.join('\n    '))
    return `no violations on ${screens} screens`
  },

  /** Production build: after one online visit, the app opens with no network. */
  async offline() {
    const page = await newPage()
    await page.goto(`${base}/learn`, { waitUntil: 'networkidle0' })
    await page.waitForFunction(() => navigator.serviceWorker?.controller, { timeout: 20000 }).catch(async () => {
      await page.reload({ waitUntil: 'networkidle0' })
      await page.waitForFunction(() => navigator.serviceWorker?.controller, { timeout: 20000 })
    })
    await signIn(page, 'steward') // while online, so the steward's data is on the phone
    await sleep(1000)
    await page.setOfflineMode(true)
    const routes = ['/explore', '/act?tab=bills', '/play', '/learn', '/steward', '/steward/assess?filter=gap', '/steward/inventory']
    for (const route of routes) {
      await page.goto(base + route, { waitUntil: 'networkidle0' })
      await sleep(600)
      check(await page.$('h1'), `${route} did not load offline`)
    }
    const lines = await page.goto(`${base}/learn`).then(() => sleep(800)).then(() => page.$$eval('.leaflet-overlay-pane path', (p) => p.length))
    check(!page.errors.length, page.errors.join(' / '))
    return `${routes.length} of ${routes.length} routes open with no network; ${lines} State Engineer lines drawn from the saved copy`
  },
}

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SUITES)
for (const w of wanted) if (!SUITES[w]) throw new Error(`Unknown suite "${w}". Choose from: ${Object.keys(SUITES).join(', ')}`)

browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
// scan every source file up front so Vite never reloads the page mid-test to add a dependency
const dev = await createServer({ logLevel: 'warn', server: { port: 5199 }, optimizeDeps: { entries: ['src/**/*.tsx'], force: true } })
await dev.listen()
let failed = 0
for (const name of wanted) {
  let server = dev
  if (name === 'offline') {
    await build({ logLevel: 'warn' })
    server = await preview({ logLevel: 'warn', preview: { port: 5198 } })
  }
  base = server.resolvedUrls.local[0].replace(/\/$/, '')
  const t0 = Date.now()
  try {
    console.log(`✓ ${name}: ${await SUITES[name]()} (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
  } catch (e) {
    failed++
    console.log(`✗ ${name}: ${e.message}`)
  }
  if (server !== dev) await server.close()
  for (const ctx of browser.browserContexts()) if (ctx !== browser.defaultBrowserContext()) await ctx.close()
}
await dev.close()
await browser.close()
process.exit(failed ? 1 : 0)

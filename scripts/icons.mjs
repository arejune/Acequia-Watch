// Renders public/icon.svg to the PNG sizes phones need. Run after editing the SVG:
//   node scripts/icons.mjs   (set CHROME_PATH if Chrome is elsewhere)
import puppeteer from 'puppeteer-core'
import { readFile } from 'node:fs/promises'
const svg = await readFile('public/icon.svg', 'utf8')
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
const page = await browser.newPage()
for (const [size, name] of [[180, 'icon-180.png'], [192, 'icon-192.png'], [512, 'icon-512.png']]) {
  await page.setViewport({ width: size, height: size })
  await page.setContent(`<style>*{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`)
  await page.screenshot({ path: `public/${name}` })
}
await browser.close()

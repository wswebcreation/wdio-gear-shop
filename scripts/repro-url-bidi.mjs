/**
 * Repro for webdriverio/webdriverio#15481
 * Compare browser.url() (BiDi) vs classic navigateTo vs raw browsingContext.navigate.
 *
 * Env:
 *   BENCH_URL           default http://localhost:4173/index.html
 *   N                   iterations (default 10)
 *   CHROME_BIN          optional Chrome binary (setup-chrome on CI)
 *   CHROMEDRIVER_PATH   optional; omit to let WDIO download a matching driver
 */
import { remote } from 'webdriverio'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const URL = process.env.BENCH_URL || 'http://localhost:4173/index.html'
const N = Number(process.env.N || 10)
const chromeBin = process.env.CHROME_BIN || process.env.CHROME_PATH
const chromedriverPath = process.env.CHROMEDRIVER_PATH

const userDataDir = mkdtempSync(join(tmpdir(), 'wdio-repro-chrome-'))

const chromeOptions = {
  args: [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
  ],
}
if (chromeBin) {
  chromeOptions.binary = chromeBin
}

const capabilities = {
  browserName: 'chrome',
  'goog:chromeOptions': chromeOptions,
}

// Only pin ChromeDriver when explicitly provided and known to match Chrome.
if (chromedriverPath) {
  capabilities['wdio:chromedriverOptions'] = { binary: chromedriverPath }
}

const browser = await remote({
  logLevel: 'error',
  bidiResponseTimeout: 60000,
  connectionRetryTimeout: 180000,
  connectionRetryCount: 2,
  capabilities,
})

try {
  const caps = browser.capabilities
  console.log(JSON.stringify({
    phase: 'session',
    isBidi: browser.isBidi,
    browserVersion: caps.browserVersion,
    pageLoadStrategy: caps.pageLoadStrategy,
    webSocketUrl: Boolean(caps.webSocketUrl),
    chromeBin: chromeBin || null,
    chromedriverPath: chromedriverPath || null,
    URL,
    N,
  }))

  if (!browser.isBidi) {
    throw new Error('Expected a BiDi session (browser.isBidi === true)')
  }

  await browser.url(URL) // warm-up

  const urlTimes = []
  const classicTimes = []
  const biDiComplete = []
  const biDiNone = []

  const tree = await browser.browsingContextGetTree({})
  const context = tree.contexts[0].context

  for (let i = 0; i < N; i++) {
    let t0 = performance.now()
    await browser.url(URL)
    urlTimes.push(Math.round(performance.now() - t0))

    t0 = performance.now()
    await browser.navigateTo(URL)
    classicTimes.push(Math.round(performance.now() - t0))

    t0 = performance.now()
    await browser.browsingContextNavigate({ context, url: URL, wait: 'complete' })
    biDiComplete.push(Math.round(performance.now() - t0))

    t0 = performance.now()
    await browser.browsingContextNavigate({ context, url: URL, wait: 'none' })
    biDiNone.push(Math.round(performance.now() - t0))
  }

  const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]
  console.log(JSON.stringify({
    phase: 'results',
    urlMed: med(urlTimes),
    classicNavigateToMed: med(classicTimes),
    browsingContextCompleteMed: med(biDiComplete),
    browsingContextNoneMed: med(biDiNone),
    deltaUrlMinusClassic: med(urlTimes) - med(classicTimes),
    urlSamples: urlTimes,
    classicSamples: classicTimes,
    browsingContextCompleteSamples: biDiComplete,
    browsingContextNoneSamples: biDiNone,
  }))
} finally {
  try {
    await browser.deleteSession()
  } catch (err) {
    console.error('deleteSession failed:', err?.message || err)
  }
}

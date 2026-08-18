/**
 * debug-driver-latency.mjs
 *
 * Isolates where the BiDi navigation latency lives:
 *
 *   Layer A — Classic WebDriver HTTP (POST /url via navigateTo)
 *             Measured: WDIO call time + ChromeDriver COMMAND→RESPONSE pairs
 *
 *   Layer B — BiDi WebSocket (browsingContext.navigate)
 *             Measured: WDIO call time + raw WebSocket send→first-response
 *             matching the same command id
 *
 *   Layer C — browsingContext.getTree (overhead reference)
 *             Same BiDi WebSocket measurement
 *
 * The delta between B and A reveals how much extra latency Chrome adds
 * on macOS for BiDi navigation vs classic Page.navigate.
 *
 * Usage:
 *   node issues/15481-bidi-url/debug-driver-latency.mjs
 *
 * Env vars:
 *   REPRO_URL         (default: http://localhost:4173)
 *   REPRO_N           (default: 12)
 *   REPRO_LOG_LEVEL   (default: error)
 *
 * Output files (issues/15481-bidi-url/output/):
 *   driver-latency-<id>.json          full report
 *   chromedriver-latency-<id>.log     verbose ChromeDriver log
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { remote } from 'webdriverio'

const URL = process.env.REPRO_URL || 'http://localhost:4173'
const N = Number(process.env.REPRO_N || 12)
const OUT_DIR = process.env.REPRO_OUT_DIR
    ? path.resolve(process.env.REPRO_OUT_DIR)
    : path.resolve(process.cwd(), 'output')
const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-')
const CD_LOG = path.join(OUT_DIR, `chromedriver-latency-${RUN_ID}.log`)
const REPORT = path.join(OUT_DIR, `driver-latency-${RUN_ID}.json`)

// ──────────────────────────────────────────────────────────
// Stats helpers
// ──────────────────────────────────────────────────────────
function median(a) {
    const s = [...a].sort((x, y) => x - y)
    return s[Math.floor(s.length / 2)]
}
function p95(a) {
    const s = [...a].sort((x, y) => x - y)
    return s[Math.floor(s.length * 0.95)]
}
function stats(samples) {
    if (!samples.length) return null
    return { med: median(samples), p95: p95(samples), min: Math.min(...samples), max: Math.max(...samples), samples }
}

// ──────────────────────────────────────────────────────────
// ChromeDriver log: classic COMMAND→RESPONSE pairs
// ──────────────────────────────────────────────────────────
function parseClassicPairs(content) {
    const TS = /\[(\d+\.\d+)\]/
    const cmds = []
    const resps = []
    let waitCount = 0

    for (const line of content.split('\n')) {
        const m = TS.exec(line)
        if (!m) continue
        const ts = parseFloat(m[1])
        if (line.includes('] COMMAND Navigate')) cmds.push(ts)
        else if (line.includes('] RESPONSE Navigate')) resps.push(ts)
        else if (line.includes('Waiting for pending navigations')) waitCount++
    }

    const pairs = cmds.map((cmd, i) => resps[i] != null ? Math.round((resps[i] - cmd) * 1000) : null).filter(Boolean)
    return { pairs, waitCount }
}

// ──────────────────────────────────────────────────────────
// BiDi WebSocket tap — measures send→matching-response time
// per command id for browsingContext.navigate and getTree
// ──────────────────────────────────────────────────────────
function tapBidiSocket(browser) {
    const socket = browser._bidiHandler?.socket
    if (!socket) return null

    const pending = new Map() // id → { sentAt, method }
    const completed = []      // { method, ms }

    const origSend = socket.send.bind(socket)
    socket.send = function (data, ...args) {
        try {
            const msg = JSON.parse(typeof data === 'string' ? data : data.toString())
            if (msg.id != null) {
                pending.set(msg.id, { sentAt: performance.now(), method: msg.method })
            }
        } catch { /* ignore non-JSON */ }
        return origSend(data, ...args)
    }

    const onMessage = (raw) => {
        try {
            const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString())
            if (msg.id != null && pending.has(msg.id)) {
                const { sentAt, method } = pending.get(msg.id)
                pending.delete(msg.id)
                completed.push({ method, ms: Math.round(performance.now() - sentAt) })
            }
        } catch { /* ignore */ }
    }
    socket.on('message', onMessage)

    return {
        stop() {
            socket.send = origSend
            socket.off('message', onMessage)
        },
        getCompleted() { return [...completed] },
    }
}

// ──────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────
async function run() {
    await fs.mkdir(OUT_DIR, { recursive: true })

    const browser = await remote({
        logLevel: process.env.REPRO_LOG_LEVEL || 'error',
        capabilities: {
            browserName: 'chrome',
            'goog:chromeOptions': {
                args: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage'],
            },
            'wdio:chromedriverOptions': {
                verbose: true,
                logPath: CD_LOG,
            },
        },
    })

    const socketTap = tapBidiSocket(browser)
    if (!socketTap) {
        console.warn('⚠  BiDi socket not found on browser._bidiHandler — socket timing unavailable')
    }

    const wdio = {
        classicNavigateTo: [],
        bidiNavigateComplete: [],
        bidiNavigateNone: [],
        getTree: [],
    }

    try {
        await browser.url(URL) // warm-up (classic fast path on mac)
        const tree = await browser.browsingContextGetTree({})
        const context = tree.contexts?.[0]?.context
        if (!context) throw new Error('No browsing context found')

        // Layer A: classic — isolated block
        for (let i = 0; i < N; i++) {
            const s = performance.now()
            await browser.navigateTo(URL)
            wdio.classicNavigateTo.push(Math.round(performance.now() - s))
        }

        // Layer B: BiDi — isolated block
        for (let i = 0; i < N; i++) {
            const s = performance.now()
            await browser.browsingContextNavigate({ context, url: URL, wait: 'complete' })
            wdio.bidiNavigateComplete.push(Math.round(performance.now() - s))

            const s2 = performance.now()
            await browser.browsingContextNavigate({ context, url: URL, wait: 'none' })
            wdio.bidiNavigateNone.push(Math.round(performance.now() - s2))
        }

        // Layer C: getTree overhead
        for (let i = 0; i < Math.ceil(N / 2); i++) {
            const s = performance.now()
            await browser.browsingContextGetTree({})
            wdio.getTree.push(Math.round(performance.now() - s))
        }
    } finally {
        socketTap?.stop()
        try { await browser.deleteSession() } catch { /* ignore teardown */ }
    }

    // Parse ChromeDriver log for classic durations
    let cdContent = ''
    try { cdContent = await fs.readFile(CD_LOG, 'utf8') } catch { /* log may not exist */ }
    const { pairs: classicDriverPairs, waitCount } = parseClassicPairs(cdContent)

    // Group BiDi socket timings by method
    const bidiSocket = {}
    for (const { method, ms } of (socketTap?.getCompleted() ?? [])) {
        if (!bidiSocket[method]) bidiSocket[method] = []
        bidiSocket[method].push(ms)
    }

    const wdioTimings = {
        classicNavigateTo: stats(wdio.classicNavigateTo),
        bidiNavigateComplete: stats(wdio.bidiNavigateComplete),
        bidiNavigateNone: stats(wdio.bidiNavigateNone),
        getTree: stats(wdio.getTree),
    }

    const deltas = wdioTimings.classicNavigateTo && wdioTimings.bidiNavigateComplete ? {
        bidiComplete_minus_classic_med: wdioTimings.bidiNavigateComplete.med - wdioTimings.classicNavigateTo.med,
        bidiNone_minus_classic_med: wdioTimings.bidiNavigateNone.med - wdioTimings.classicNavigateTo.med,
        interpretation: wdioTimings.bidiNavigateComplete.med > wdioTimings.classicNavigateTo.med * 2
            ? 'BiDi navigation significantly slower than classic on this platform'
            : 'BiDi and classic are within 2× of each other',
    } : null

    const driverLevel = {
        classicHttp: {
            note: 'ChromeDriver COMMAND Navigate → RESPONSE Navigate (includes Page.navigate DevTools round-trip)',
            count: classicDriverPairs.length,
            ...(classicDriverPairs.length ? stats(classicDriverPairs) : { note: 'no pairs found' }),
        },
        bidiWebSocket: Object.keys(bidiSocket).length
            ? Object.fromEntries(Object.entries(bidiSocket).map(([m, s]) => [m, stats(s)]))
            : { note: 'No BiDi WebSocket messages captured — socket tap may not have attached' },
        waitingForPendingNavigationsCount: waitCount,
    }

    const report = {
        meta: {
            runId: RUN_ID,
            url: URL,
            iterations: N,
            platformName: browser.capabilities.platformName,
            browserName: browser.capabilities.browserName,
            browserVersion: browser.capabilities.browserVersion,
            isBidi: browser.isBidi,
            chromedriverLogPath: CD_LOG,
            reportPath: REPORT,
        },
        wdioTimings,
        deltas,
        driverLevel,
    }

    await fs.writeFile(REPORT, JSON.stringify(report, null, 2), 'utf8')

    // Compact stdout summary for CI logs
    console.log(JSON.stringify({
        meta: report.meta,
        wdioSummary: {
            classic_med: wdioTimings.classicNavigateTo?.med,
            bidiComplete_med: wdioTimings.bidiNavigateComplete?.med,
            bidiNone_med: wdioTimings.bidiNavigateNone?.med,
            getTree_med: wdioTimings.getTree?.med,
        },
        deltas,
        driverLevel: {
            classicHttp_med: driverLevel.classicHttp?.med ?? null,
            classicHttp_p95: driverLevel.classicHttp?.p95 ?? null,
            classicHttp_count: driverLevel.classicHttp?.count ?? 0,
            bidiWebSocket: Object.keys(bidiSocket).length
                ? Object.fromEntries(Object.entries(bidiSocket).map(([m, s]) => [m, { med: median(s), count: s.length }]))
                : 'no BiDi messages captured',
            waitingForPendingNavigationsCount: waitCount,
        },
        reportPath: REPORT,
        chromedriverLogPath: CD_LOG,
    }, null, 2))
}

run().catch((err) => {
    console.error(err)
    process.exitCode = 1
})

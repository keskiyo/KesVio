// Developer benchmark of the external alias index inside the real KesVio WebView2.
//
// Start the dev app with remote debugging enabled, then run this script:
//   set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222
//   npm run tauri dev
//   node scripts/search-aliases/measure-webview.mjs [port]
//
// It reloads the page once, records the JS heap at every `kesvio:*` performance mark
// (store ready, index import begin, decode done, installed, reverse index built), measures a
// first alias search, and then compares the garbage-collected heap with and without the index
// installed. Nothing is sent anywhere; the output is printed to the terminal only.
const port = Number(process.argv[2] ?? 9222)
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const targets = await fetch(`http://127.0.0.1:${port}/json`).then(response =>
	response.json(),
)
const page = targets.find(
	target => target.type === 'page' && target.url.includes('localhost:1420'),
)
if (!page) throw new Error('no KesVio dev page on the debugging port')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise(resolve => (ws.onopen = resolve))
let seq = 0
const pending = new Map()
ws.onmessage = event => {
	const message = JSON.parse(event.data)
	if (message.id && pending.has(message.id)) {
		pending.get(message.id)(message)
		pending.delete(message.id)
	}
}
const send = (method, params = {}) =>
	new Promise(resolve => {
		const id = ++seq
		pending.set(id, resolve)
		ws.send(JSON.stringify({ id, method, params }))
	})
const evaluate = async expression =>
	(
		await send('Runtime.evaluate', {
			expression,
			awaitPromise: true,
			returnByValue: true,
		})
	).result?.result?.value
const mb = bytes => `${(bytes / 1048576).toFixed(1)} MB`
const heapAfterGc = async () => {
	await send('HeapProfiler.collectGarbage')
	await sleep(150)
	await send('HeapProfiler.collectGarbage')
	return evaluate('performance.memory.usedJSHeapSize')
}

await send('Page.enable')
await send('HeapProfiler.enable')
await send('Page.addScriptToEvaluateOnNewDocument', {
	source: `(() => {
		window.__kesvioMarks = []
		performance.setResourceTimingBufferSize(4000)
		const original = performance.mark.bind(performance)
		performance.mark = (name, options) => {
			const entry = original(name, options)
			if (String(name).startsWith('kesvio:'))
				window.__kesvioMarks.push({ name, at: performance.now(), heap: performance.memory.usedJSHeapSize })
			return entry
		}
	})()`,
})
await send('Page.reload')
for (let attempt = 0; attempt < 100; attempt += 1) {
	await sleep(200)
	const done = await evaluate(
		`Array.isArray(window.__kesvioMarks) && window.__kesvioMarks.some(mark => mark.name === 'kesvio:alias-index-installed')`,
	)
	if (done) break
}
await sleep(500)
const marks = await evaluate('window.__kesvioMarks')
const paint = await evaluate(
	`performance.getEntriesByType('paint').map(entry => ({ name: entry.name, at: entry.startTime }))`,
)
const navigation = await evaluate(
	`(() => { const nav = performance.getEntriesByType('navigation')[0]; return nav ? { domContentLoaded: nav.domContentLoadedEventEnd, load: nav.loadEventEnd } : null })()`,
)

console.log(
	'timeline after reload (ms since navigation, JS heap at that moment):',
)
for (const entry of paint ?? [])
	console.log(`  ${entry.at.toFixed(0).padStart(6)} ms  ${entry.name}`)
for (const mark of marks ?? [])
	console.log(
		`  ${mark.at.toFixed(0).padStart(6)} ms  ${mark.name}  heap ${mb(mark.heap)}`,
	)
if (navigation)
	console.log(
		`  ${navigation.domContentLoaded.toFixed(0).padStart(6)} ms  DOMContentLoaded, ${navigation.load.toFixed(0)} ms load`,
	)

const typed = await evaluate(`(() => {
	const input = [...document.querySelectorAll('input')].find(node => node.placeholder === 'Search apps…')
	if (!input) return false
	const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
	const before = performance.now()
	setter.call(input, 'kube')
	input.dispatchEvent(new Event('input', { bubbles: true }))
	window.__kesvioSearchStarted = before
	return true
})()`)
await sleep(600)
const firstSearch = await evaluate(`(() => {
	const marks = window.__kesvioMarks ?? []
	const built = marks.find(mark => mark.name === 'kesvio:alias-reverse-index-built')
	return { built: built ? { at: built.at, heap: built.heap } : null, heapNow: performance.memory.usedJSHeapSize, started: window.__kesvioSearchStarted ?? null }
})()`)
await evaluate(`(() => {
	const input = [...document.querySelectorAll('input')].find(node => node.placeholder === 'Search apps…')
	if (!input) return
	Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '')
	input.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
const modules = await evaluate(`(() => {
	const served = name => performance.getEntriesByType('resource').map(entry => entry.name).find(url => url.includes(name)) ?? null
	return { index: served('/search/knownPackageIndex.ts'), data: served('/generated/knownPackages.ts') }
})()`)
if (!modules.index || !modules.data)
	throw new Error(
		'could not find the served alias modules in the resource timeline',
	)
const status = await evaluate(
	`import(${JSON.stringify(modules.index)}).then(m => ({ status: m.knownPackageIndexStatus(), entries: m.knownPackageEntries().length }))`,
)
console.log(`index status: ${status.status}, entries ${status.entries}`)
if (typed && firstSearch.built)
	console.log(
		`first alias search: reverse index built ${(firstSearch.built.at - firstSearch.started).toFixed(1)} ms after the keystroke, heap ${mb(firstSearch.built.heap)} at that moment, ${mb(firstSearch.heapNow)} after the results rendered`,
	)
else
	console.log(
		'first alias search: search input not found or reverse index already built',
	)

const probeSearch = async () => {
	for (const value of ['kube', '']) {
		await evaluate(`(() => {
			const input = [...document.querySelectorAll('input')].find(node => node.placeholder === 'Search apps…')
			if (!input) return
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)})
			input.dispatchEvent(new Event('input', { bubbles: true }))
		})()`)
		await sleep(400)
	}
}
await probeSearch()
const withIndex = await heapAfterGc()
await evaluate(
	`import(${JSON.stringify(modules.index)}).then(m => m.installKnownPackageEntries([]))`,
)
await probeSearch()
const withoutIndex = await heapAfterGc()
await evaluate(
	`Promise.all([import(${JSON.stringify(modules.index)}), import(${JSON.stringify(modules.data)})]).then(([m, g]) => m.installKnownPackageEntries(m.decodeKnownPackageIndex(g.KNOWN_PACKAGE_INDEX)))`,
)
await probeSearch()
const reinstalled = await heapAfterGc()
console.log(
	`heap after GC: with index ${mb(withIndex)}, without decoded entries ${mb(withoutIndex)}, reinstalled ${mb(reinstalled)} → decoded entries + reverse index ${mb(withIndex - withoutIndex)} (the raw JSON module stays referenced by the chunk and is not included)`,
)
await evaluate(
	`import(${JSON.stringify(modules.data)}).then(g => { window.__kesvioRawCopy = JSON.parse(JSON.stringify(g.KNOWN_PACKAGE_INDEX)); return true })`,
)
const withRawCopy = await heapAfterGc()
await evaluate('(() => { window.__kesvioRawCopy = null; return true })()')
const afterRelease = await heapAfterGc()
console.log(
	`raw index module (string table + records): ${mb(withRawCopy - afterRelease)}; total external tier ≈ ${mb(withRawCopy - afterRelease + (withIndex - withoutIndex))}`,
)
ws.close()

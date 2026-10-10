import { spawn } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { connect } from 'node:net'
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { remote } from 'webdriverio'
import {
	defaults,
	folderStamp,
	otherKesVioProcesses,
	prepareWorkspace,
	protectedFolders,
} from './workspace.mjs'

const application = process.env.KESVIO_E2E_APP ?? defaults.application
const nativeDriver = process.env.KESVIO_E2E_DRIVER ?? defaults.nativeDriver
const PORT = 4444
const SCAN_TIMEOUT = 120_000

let driver
let browser
let workspace
const baseline = new Map()

function waitForPort(port, timeout) {
	const deadline = Date.now() + timeout
	return new Promise((resolve, reject) => {
		const attempt = () => {
			const socket = connect(port, '127.0.0.1')
			socket.once('connect', () => {
				socket.end()
				resolve()
			})
			socket.once('error', () => {
				socket.destroy()
				if (Date.now() > deadline)
					reject(new Error(`tauri-driver did not listen on ${port}`))
				else setTimeout(attempt, 250)
			})
		}
		attempt()
	})
}

function inPage(script) {
	return browser.execute(script)
}

async function openNavigationItem(label) {
	const direct = await inPage(
		`return [...document.querySelectorAll('button')].some(b => b.textContent.trim() === ${JSON.stringify(label)} && b.offsetParent !== null)`,
	)
	if (!direct)
		await (await browser.$('button[aria-label="Open navigation"]')).click()
	const item = await browser.$(`//button[normalize-space()="${label}"]`)
	await item.waitForDisplayed({ timeout: 10_000 })
	await item.click()
}

describe('KesVio desktop smoke', () => {
	before(async () => {
		assert.ok(
			existsSync(application),
			`build the app first: ${application}`,
		)
		assert.ok(
			existsSync(nativeDriver),
			`msedgedriver not found: ${nativeDriver}`,
		)
		const running = otherKesVioProcesses()
		assert.deepEqual(
			running,
			[],
			'quit every KesVio and dev instance first: the single-instance guard would end the test app',
		)
		for (const folder of protectedFolders())
			baseline.set(folder, folderStamp(folder))
		workspace = prepareWorkspace(application)
		driver = spawn(
			'tauri-driver',
			['--port', String(PORT), '--native-driver', nativeDriver],
			{
				env: { ...process.env, ...workspace.environment },
				stdio: 'ignore',
				windowsHide: true,
			},
		)
		await waitForPort(PORT, 15_000)
		browser = await remote({
			hostname: '127.0.0.1',
			port: PORT,
			logLevel: 'warn',
			capabilities: {
				'tauri:options': { application: workspace.executable },
			},
		})
	})

	after(async () => {
		await browser?.deleteSession().catch(() => undefined)
		if (driver?.pid)
			spawn('taskkill', ['/PID', String(driver.pid), '/T', '/F'], {
				stdio: 'ignore',
			})
		if (workspace && !process.env.KESVIO_E2E_KEEP)
			rmSync(workspace.root, {
				recursive: true,
				force: true,
				maxRetries: 5,
			})
	})

	it('opens the KesVio window', async () => {
		assert.equal(await browser.getTitle(), 'KesVio')
	})

	it('scans the fixture folder and renders app cards', async () => {
		await browser.waitUntil(
			async () =>
				(await inPage(
					`return document.querySelectorAll('button[aria-label^="Manage "]').length`,
				)) >= 2,
			{
				timeout: SCAN_TIMEOUT,
				timeoutMsg: 'no app cards after the startup scan',
			},
		)
	})

	it('selects the search field on Ctrl+F', async () => {
		await (await browser.$('body')).click()
		await browser.keys(['Control', 'f'])
		await browser.waitUntil(
			async () =>
				(await inPage(
					`return document.activeElement?.getAttribute('placeholder')`,
				)) === 'Search apps…',
			{ timeout: 5_000, timeoutMsg: 'Ctrl+F did not focus search' },
		)
	})

	it('names the best match and moves from search to the cards with ArrowDown', async () => {
		const search = await browser.$('input[placeholder="Search apps…"]')
		await search.setValue('Alpha')
		await browser.waitUntil(
			async () =>
				/Enter opens/.test(
					await (await browser.$('header [role="status"]')).getText(),
				),
			{ timeout: 10_000, timeoutMsg: 'the status never named a match' },
		)
		await browser.keys(['ArrowDown'])
		assert.equal(
			await inPage(
				`return document.activeElement?.hasAttribute('data-launch-target')`,
			),
			true,
		)
		await browser.keys(['ArrowUp'])
		assert.equal(
			await inPage(
				`return document.activeElement?.getAttribute('placeholder')`,
			),
			'Search apps…',
		)
		await search.clearValue()
	})

	it('opens the actions menu of a card', async () => {
		await browser.keys(['Escape'])
		const [manage] = await browser.$$('button[aria-label^="Manage "]')
		await manage.scrollIntoView()
		await manage.moveTo()
		await manage.click()
		const menu = await browser.$('[role="menu"][aria-label$=" actions"]')
		await menu.waitForDisplayed({ timeout: 5_000 })
		await browser.keys(['Escape'])
		await menu.waitForDisplayed({ reverse: true, timeout: 5_000 })
	})

	it('opens Settings with the global shortcut listed', async () => {
		await openNavigationItem('Settings')
		const heading = await browser.$('h1=Settings')
		await heading.waitForDisplayed({ timeout: 10_000 })
		const shortcuts = await browser.$(
			'section[aria-label="Keyboard shortcuts"]',
		)
		await shortcuts.scrollIntoView()
		await shortcuts.waitForDisplayed({ timeout: 10_000 })
		await browser.waitUntil(
			async () => /Show KesVio/.test(await shortcuts.getText()),
			{ timeout: 10_000, timeoutMsg: 'Show KesVio row missing' },
		)
		const binding = await browser.$(
			'[role="group"][aria-label="Global shortcut"]',
		)
		assert.match(await binding.getText(), /\w\+\w/)
	})

	it('leaves the per-user and installed stores untouched', () => {
		for (const [folder, stamp] of baseline)
			assert.equal(folderStamp(folder), stamp, `${folder} was written`)
	})
})

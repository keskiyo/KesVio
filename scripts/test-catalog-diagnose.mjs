import assert from 'node:assert/strict'
import test from 'node:test'
import { diagnoseCatalog } from './catalog-diagnose/lib.mjs'

const target = 'C:\\Program Files\\SoftEther VPN Client\\vpncmgr_x64.exe'

function source(name, path, launchArguments) {
	return {
		name,
		path,
		resolvedPath: target,
		launchArguments,
		artifactKind: 'application',
		category: 'security',
		visibilityClass: 'primary',
		visibilityReasons: ['start_menu_registration'],
	}
}

function catalog(apps) {
	return {
		schemaVersion: 11,
		apps,
		sources: [
			{
				key: 'start-menu',
				apps: [
					source(
						"Manage Remote Computer's SoftEther VPN Client",
						'C:\\Menu\\Manage Remote.lnk',
						'/remote',
					),
					source(
						'SoftEther VPN Client Manager',
						'C:\\Menu\\SoftEther VPN Client Manager.lnk',
					),
				],
			},
		],
	}
}

test('traces source launch modes to the ordinary final card', () => {
	const output = diagnoseCatalog(
		catalog([
			{
				...source(
					'SoftEther VPN Client Manager',
					'C:\\Menu\\SoftEther VPN Client Manager.lnk',
				),
				id: 'target:softether',
			},
		]),
		'SoftEther VPN Client Manager',
	)

	assert.match(output, /Discovery \(2\)/)
	assert.match(output, /arguments: \/remote/)
	assert.match(output, /arguments: \(none\)/)
	assert.match(output, /Final catalog \(1\)/)
	assert.match(output, /winner: SoftEther VPN Client Manager/)
	assert.match(output, /visibility: primary/)
	assert.match(output, /result: FOUND/)
})

test('reports a record lost after discovery', () => {
	const output = diagnoseCatalog(catalog([]), 'SoftEther VPN Client Manager')

	assert.match(output, /Discovery \(2\)/)
	assert.match(output, /Final catalog \(0\)/)
	assert.match(output, /result: LOST_AFTER_DISCOVERY/)
})

test('reports when dedup kept a correlated card that no longer matches the query', () => {
	const output = diagnoseCatalog(
		catalog([
			{
				...source(
					"Manage Remote Computer's SoftEther VPN Client",
					'C:\\Menu\\Manage Remote.lnk',
					'/remote',
				),
				id: 'target:softether',
			},
		]),
		'SoftEther VPN Client Manager',
	)

	assert.match(
		output,
		/winner: Manage Remote Computer's SoftEther VPN Client/,
	)
	assert.match(output, /query match: no/)
	assert.match(output, /result: FINAL_NAME_MISMATCH/)
})

import { describe, expect, it } from 'vitest'
import {
	confidenceFor,
	forbiddenReason,
	isSafeSoloExternalName,
	normalizePublisherIdentity,
	publisherToken,
} from '../../scripts/search-aliases/lib/policy.mjs'

function context(name, { owners = 1, curated = [], publisherKey = '' } = {}) {
	return {
		owners: new Map([[name, owners]]),
		curatedNames: new Set(curated),
		publisherKey,
	}
}

describe('normalizePublisherIdentity', () => {
	it.each([
		['Adobe Inc.', 'adobe'],
		['Adobe Systems Incorporated', 'adobe'],
		['Adobe', 'adobe'],
		['Proton AG', 'proton'],
		['Proton Technologies AG', 'proton'],
		['Google LLC', 'google'],
		['Microsoft Corporation', 'microsoft'],
		['The Rust Project Developers', 'rust'],
		['Electronic Arts', 'electronic arts'],
		['JetBrains s.r.o.', 'jetbrains'],
		['Python Software Foundation', 'python'],
		['Node.js Foundation', 'node.js'],
		['Igor Pavlov', 'igor pavlov'],
		['Sordum.org', 'sordum'],
		['Sordum', 'sordum'],
		['Notepad++ Team', 'notepad++'],
	])('reduces %s to the key %s', (raw, key) => {
		expect(normalizePublisherIdentity(raw).key).toBe(key)
		expect(publisherToken(raw)).toBe(key)
	})

	it('keeps the normalized full publisher beside the key and never yields a key under three characters', () => {
		expect(
			normalizePublisherIdentity('Adobe Systems Incorporated'),
		).toEqual({
			full: 'adobe systems incorporated',
			key: 'adobe',
		})
		expect(normalizePublisherIdentity('AB Ltd').key).toBe('ab ltd')
		expect(normalizePublisherIdentity('')).toEqual({ full: '', key: '' })
	})

	it('strips legal suffixes only from the end', () => {
		expect(publisherToken('Inc Software Tools')).toBe('inc software tools')
		expect(publisherToken('Company of Heroes Studio')).toBe(
			'company of heroes',
		)
	})
})

describe('isSafeSoloExternalName', () => {
	it.each([
		'manager',
		'notes',
		'editor',
		'console',
		'assistant',
		'video editor',
		'pro editor',
	])('rejects the generic or category-only name %s', name => {
		expect(isSafeSoloExternalName(name, context(name))).toBe(false)
	})

	it.each([
		'figma agent',
		'windows 10 update assistant',
		'acme setup',
		'foo installer',
		'bar driver',
		'chrome beta',
	])('rejects the helper-like or high-risk name %s', name => {
		expect(isSafeSoloExternalName(name, context(name))).toBe(false)
	})

	it('rejects host stems, short names, vendor-only names, urls and curated identity names', () => {
		expect(isSafeSoloExternalName('ruby', context('ruby'))).toBe(false)
		expect(isSafeSoloExternalName('abc', context('abc'))).toBe(false)
		expect(isSafeSoloExternalName('1234', context('1234'))).toBe(false)
		expect(
			isSafeSoloExternalName(
				'acme',
				context('acme', { publisherKey: 'acme' }),
			),
		).toBe(false)
		expect(
			isSafeSoloExternalName(
				'xz utils <https://x.y>',
				context('xz utils <https://x.y>'),
			),
		).toBe(false)
		expect(
			isSafeSoloExternalName(
				'visual studio code',
				context('visual studio code', {
					curated: ['visual studio code'],
				}),
			),
		).toBe(false)
	})

	it('rejects a name carried by more than one package in the corpus', () => {
		expect(
			isSafeSoloExternalName(
				'acme sync',
				context('acme sync', { owners: 2 }),
			),
		).toBe(false)
		expect(isSafeSoloExternalName('acme sync', context('acme sync'))).toBe(
			true,
		)
	})

	it('accepts a specific product name that is unique', () => {
		expect(
			isSafeSoloExternalName(
				'rivatuner statistics server',
				context('rivatuner statistics server'),
			),
		).toBe(true)
		expect(
			isSafeSoloExternalName(
				'hard disk sentinel',
				context('hard disk sentinel'),
			),
		).toBe(true)
	})
})

describe('forbiddenReason', () => {
	it.each([
		['op', 'command', 'too_short'],
		['vpn', 'name', 'semantic'],
		['agent', 'name', 'generic'],
		['electron', 'derived', 'host'],
		['git', 'command', 'generic_command'],
		['java', 'command', 'host'],
		['run', 'command', 'generic'],
		['baulk-update', 'command', 'helper_command'],
		['blit-daemon', 'portable', 'helper_command'],
		['1234', 'name', 'no_letters'],
		['/verysilent', 'command', 'invalid_characters'],
		['--silent', 'command', 'invalid_characters'],
		['https://example.com', 'name', 'invalid_characters'],
		['bin/tool', 'command', 'invalid_characters'],
		['tool (x64)', 'name', 'invalid_characters'],
		['kubectl', 'command', null],
		['c++', 'name', null],
		['notepad++', 'name', null],
		['node.js', 'name', null],
		['7-zip', 'name', null],
		["sam's tool", 'name', null],
		['мой продукт', 'name', null],
	])('classifies %s (%s) as %s', (value, kind, reason) => {
		expect(forbiddenReason(value, kind)).toBe(reason)
	})
})

describe('confidenceFor', () => {
	it('grants normal only to a unique value and weak to two or three owners', () => {
		expect(confidenceFor('kubectl', 1, 'command')).toBe('normal')
		expect(confidenceFor('kubectl', 2, 'command')).toBe('weak')
		expect(confidenceFor('kubectl', 3, 'command')).toBe('weak')
		expect(confidenceFor('kubectl', 4, 'command')).toBeNull()
	})

	it('grants a three-character value weak only when unique and never from a derived token', () => {
		expect(confidenceFor('adb', 1, 'command')).toBe('weak')
		expect(confidenceFor('adb', 2, 'command')).toBeNull()
		expect(confidenceFor('adb', 1, 'derived')).toBeNull()
	})
})

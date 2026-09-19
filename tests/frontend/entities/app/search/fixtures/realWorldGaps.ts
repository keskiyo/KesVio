import type { AppInfo } from '../../../../../../src/entities/app'
import { app, shortcut } from './app'

export type GapClass =
	| 'MISSING_CURATED_ALIAS'
	| 'EXTERNAL_PACKAGE_MISSING'
	| 'EXTERNAL_IDENTITY_FAILED'
	| 'GENERATED_ALIAS_MISSING'
	| 'HELPER_FALSE_VETO'
	| 'FALSE_POSITIVE_IDENTITY'
	| 'RANKING_ERROR'
	| 'EXPECTED_BEHAVIOR'
	| 'UI_SEARCH_PRESENTATION'

export interface RealWorldGap {
	query: string
	catalog: AppInfo[]
	expectedTop: string | null
	mustNotOwn?: string[]
	classification: GapClass
	why: string
}

// One row per real search failure that was reproduced and fixed (or classified as expected).
// Records are copied from the scanner's view of the machine that reported the problem, with
// paths trimmed to what the alias engine reads. Add a row before touching any rule.
export const REAL_WORLD_GAPS: RealWorldGap[] = [
	{
		query: 'windows sdk',
		catalog: [
			app({
				id: 'winsdk',
				name: 'Windows Software Development Kit',
				publisher: 'Microsoft Corporation',
				path: String.raw`C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\winsdk.exe`,
			}),
		],
		expectedTop: 'winsdk',
		classification: 'EXTERNAL_IDENTITY_FAILED',
		why: 'The Programs & Features name is the long form; the winget package name "Windows SDK" is an alternate name form and must survive pruning (generator v2, 2026-09-20).',
	},
	{
		query: 'windowsupdateblocker',
		catalog: [
			app({
				id: 'wub',
				name: 'Wub',
				path: String.raw`E:\Tools\Disable_Update\Wub\Wub.exe`,
				publisher: 'Sordum',
				productName: 'Windows Update Blocker',
			}),
		],
		expectedTop: 'wub',
		classification: 'EXTERNAL_IDENTITY_FAILED',
		why: 'The winget publisher is "Sordum.org" while the executable reports "Sordum"; the publisher key now drops a trailing domain suffix so the executable + publisher clause corroborates (2026-09-20). An earlier generator cut also pruned the package for the word "Update" in its name (HELPER_FALSE_VETO, 2026-09-19).',
	},
	{
		query: 'java',
		catalog: [
			app({
				id: 'ledger',
				name: 'Acme Ledger',
				path: String.raw`C:\Program Files\Java\jre-21\bin\javaw.exe`,
				productName: 'Java(TM) Platform SE 21',
				publisher: 'Oracle Corporation',
			}),
		],
		expectedTop: 'ledger',
		mustNotOwn: ['java', 'jre', 'jdk'],
		classification: 'FALSE_POSITIVE_IDENTITY',
		why: 'A jar launched through javaw.exe carries the runtime\'s product metadata; the curated java entry now also requires the name to start with "java" (2026-09-19). The record still surfaces for "java" through the product-name substring (score 50), which is the ordinary ladder, not an alias.',
	},
	{
		query: 'youtubedownloader',
		catalog: [
			shortcut({
				id: 'ytd',
				name: 'YouTube Downloader',
				originalFilename: null,
			}),
		],
		expectedTop: 'ytd',
		classification: 'EXPECTED_BEHAVIOR',
		why: 'Without a publisher the winget package is recognised by name only, so its aliases are weak; weak exact still ranks the only candidate first. Hydration with the publisher would make it normal.',
	},
	{
		query: 'agent',
		catalog: [
			app({ id: 'chatgpt', name: 'ChatGPT', description: 'AI agent' }),
			app({
				id: 'ssm',
				name: 'Amazon SSM Agent',
				path: String.raw`C:\Program Files\Amazon\SSM\amazon-ssm-agent.exe`,
			}),
		],
		expectedTop: 'ssm',
		classification: 'EXPECTED_BEHAVIOR',
		why: 'A generic word matches names and descriptions through the ordinary name/secondary ladder; no record owns "agent" as an alias and the helper-vetoed agent still ranks by its own name.',
	},
]

import type { AppMatchFacts } from './types'

const HELPER_WORDS = new Set([
	'update',
	'updater',
	'helper',
	'webhelper',
	'errorreporter',
	'setup',
	'installer',
	'uninstall',
	'uninstaller',
	'agent',
	'service',
	'crash',
	'reporter',
	'redistributable',
	'redistributables',
	'webview',
	'webview2',
	'add-in',
	'addin',
	'plugin',
	'tunnel',
	'proxy',
	'bootstrapper',
	'деинсталлировать',
	'удалить',
	'удаление',
	'установить',
	'установка',
	'обновить',
	'обновление',
	'агент',
])

const HELPER_STEM = /setup|install|updat|svc(?=[._-]|\d|$)/
const ARCHITECTURE_TOKEN =
	/(?:^|[-_.])(?:x64|x86|win64|win32|amd64|arm64|ia32)(?=[-_.]|$)/
const RELEASE_FILE_DIGITS = /\d/

const HELPER_EXECUTABLES = new Set([
	'update.exe',
	'updater.exe',
	'setup.exe',
	'install.exe',
	'installer.exe',
	'uninstall.exe',
	'uninstaller.exe',
	'agent.exe',
	'crashpad_handler.exe',
	'chrome_proxy.exe',
	'msedge_proxy.exe',
	'msedgewebview2.exe',
])

export function isReleaseFileName(fileName: string): boolean {
	const stem = fileName.replace(/\.[a-z]+$/, '')
	const match = ARCHITECTURE_TOKEN.exec(stem)
	if (!match) return false
	const rest =
		stem.slice(0, match.index) + stem.slice(match.index + match[0].length)
	return RELEASE_FILE_DIGITS.test(rest)
}

export function isHelperName(name: string): boolean {
	return name.split(/[\s:()]+/).some(word => HELPER_WORDS.has(word))
}

export function endsWithHelperWord(name: string): boolean {
	const words = name.split(/[\s:()]+/).filter(word => word.length > 0)
	return words.length > 1 && HELPER_WORDS.has(words[words.length - 1]!)
}

export type HelperReason =
	| 'artifact'
	| 'helper executable'
	| 'helper executable stem'
	| 'helper original file name'
	| 'release file name'
	| 'helper word in name'

export function helperReason(facts: AppMatchFacts): HelperReason | null {
	if (facts.artifact) return 'artifact'
	if (facts.pathExecutable && HELPER_EXECUTABLES.has(facts.pathExecutable))
		return 'helper executable'
	if (facts.pathExecutable && HELPER_STEM.test(facts.pathExecutable))
		return 'helper executable stem'
	if (facts.originalFilename && HELPER_STEM.test(facts.originalFilename))
		return 'helper original file name'
	if (facts.pathExecutable && isReleaseFileName(facts.pathExecutable))
		return 'release file name'
	if (isHelperName(facts.name)) return 'helper word in name'
	return null
}

export function isHelperRecord(facts: AppMatchFacts): boolean {
	return helperReason(facts) !== null
}

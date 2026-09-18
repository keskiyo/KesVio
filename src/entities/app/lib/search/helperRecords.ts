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
	'sdk',
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

const HELPER_STEM = /setup|install|updat/

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

export function isHelperRecord(facts: AppMatchFacts): boolean {
	if (facts.artifact) return true
	if (facts.pathExecutable && HELPER_EXECUTABLES.has(facts.pathExecutable))
		return true
	if (facts.pathExecutable && HELPER_STEM.test(facts.pathExecutable))
		return true
	if (facts.originalFilename && HELPER_STEM.test(facts.originalFilename))
		return true
	for (const word of facts.name.split(/[\s:()]+/))
		if (HELPER_WORDS.has(word)) return true
	return false
}

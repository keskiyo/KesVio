import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const LOCK_PATH = join(
	process.cwd(),
	'data',
	'search-aliases',
	'winget.lock.json',
)

export function cacheRoot() {
	return (
		process.env.KESVIO_ALIAS_CACHE ??
		join(
			process.env.LOCALAPPDATA ?? process.env.HOME ?? process.cwd(),
			'kesvio-dev',
			'winget-pkgs',
		)
	)
}

export function readLock() {
	if (!existsSync(LOCK_PATH)) return null
	return JSON.parse(readFileSync(LOCK_PATH, 'utf8'))
}

export function snapshotRoot(lock) {
	return join(cacheRoot(), `winget-pkgs-${lock.commit}`, 'manifests')
}

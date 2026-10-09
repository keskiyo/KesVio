import { lazy } from 'react'

const loadBackupRestore = () => import('../../pages/backup-restore')
const loadCatalogHealth = () => import('../../pages/catalog-health')
const loadScenarios = () => import('../../pages/scenarios')
const loadSettings = () => import('../../pages/settings')

export const BackupRestorePage = lazy(() =>
	loadBackupRestore().then(module => ({ default: module.BackupRestorePage })),
)
export const CatalogHealthPage = lazy(() =>
	loadCatalogHealth().then(module => ({ default: module.CatalogHealthPage })),
)
export const ScenariosPage = lazy(() =>
	loadScenarios().then(module => ({ default: module.ScenariosPage })),
)
export const SettingsPage = lazy(() =>
	loadSettings().then(module => ({ default: module.SettingsPage })),
)

export function preloadSecondaryPages(): Promise<void> {
	return Promise.all([
		loadBackupRestore(),
		loadCatalogHealth(),
		loadScenarios(),
		loadSettings(),
	]).then(
		() => undefined,
		() => undefined,
	)
}

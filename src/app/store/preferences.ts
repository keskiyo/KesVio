export { normalizePreferences } from './preferences/preferencesNormalize'
export {
	type AppPreferencesV22,
	CURRENT_PREFERENCES_VERSION,
	DEFAULT_PREFERENCES,
	type LegacyCanonicalPreferences,
	PREFERENCES_BACKUP_KEY,
	PREFERENCES_KEY,
	type PreferenceImportResult,
	type PreferenceTransferResult,
} from './preferences/preferencesSchema'
export {
	hasPreferenceBackup,
	hasNewerStoredPreferences,
	parsePreferenceImport,
	readPreferenceBackup,
	readPreferences,
	serializePreferences,
	writePreferences,
} from './preferences/preferencesStorage'

import { useCallback, useState } from 'react'

export type SettingsArea = 'settings' | 'discovery' | 'maintenance'

export interface SettingsReporter {
	reportError(area: SettingsArea, message: string): void
	clearError(): void
}

export function useSettingsFeedback() {
	const [error, setError] = useState<string | null>(null)
	const [errorArea, setErrorArea] = useState<SettingsArea | null>(null)

	const reportError = useCallback((area: SettingsArea, message: string) => {
		setError(message)
		setErrorArea(area)
	}, [])

	const clearError = useCallback(() => {
		setError(null)
		setErrorArea(null)
	}, [])

	return { error, errorArea, reportError, clearError }
}

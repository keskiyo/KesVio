import { useCallback, useState } from 'react'

export function useDiscoveryNavigation(selectSettings: () => void) {
	const [focusDiscovery, setFocusDiscovery] = useState(false)
	const clearDiscoveryFocus = useCallback(() => setFocusDiscovery(false), [])
	function configureFolders() {
		setFocusDiscovery(true)
		selectSettings()
	}
	return { focusDiscovery, clearDiscoveryFocus, configureFolders }
}

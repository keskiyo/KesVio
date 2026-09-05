export const FRONTEND_READY_EVENT = 'app://frontend-ready'

export function scheduleFrontendReady(
	signal: () => void,
	requestFrame: typeof requestAnimationFrame = requestAnimationFrame,
): void {
	requestFrame(() => requestFrame(() => signal()))
}

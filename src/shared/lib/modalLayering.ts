function openModals(): NodeListOf<HTMLElement> {
	return document.querySelectorAll<HTMLElement>('[aria-modal="true"]')
}

export function isTopmostModal(container: HTMLElement): boolean {
	const modals = openModals()
	const index = Array.prototype.indexOf.call(modals, container)
	return index === -1 || index === modals.length - 1
}

export function topmostModal(): HTMLElement | null {
	const modals = openModals()
	return modals.length ? modals[modals.length - 1] : null
}

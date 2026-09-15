export function isTopmostModal(container: HTMLElement): boolean {
	const modals = document.querySelectorAll<HTMLElement>('[aria-modal="true"]')
	const index = Array.prototype.indexOf.call(modals, container)
	return index === -1 || index === modals.length - 1
}

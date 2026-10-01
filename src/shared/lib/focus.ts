const FOCUSABLE =
	'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

export function keepFocusNearRemovedItem(item: Element | null | undefined) {
	if (!item) return
	const neighbours = [item.nextElementSibling, item.previousElementSibling]
	setTimeout(() => {
		if (item.isConnected) return
		const active = document.activeElement
		if (active && active !== document.body) return
		for (const neighbour of neighbours) {
			const target = neighbour?.isConnected
				? neighbour.querySelector<HTMLElement>(FOCUSABLE)
				: null
			if (target) {
				target.focus()
				return
			}
		}
	}, 0)
}

function isRendered(element: HTMLElement) {
	return !element.closest('[hidden], [inert], [aria-hidden="true"]')
}

function counterpartOf(element: HTMLElement): HTMLElement | null {
	const label = element.getAttribute('aria-label')
	if (!label) return null
	return (
		Array.from(document.querySelectorAll<HTMLElement>('[aria-label]')).find(
			candidate =>
				candidate.getAttribute('aria-label') === label &&
				candidate.matches(FOCUSABLE) &&
				isRendered(candidate),
		) ?? null
	)
}

export function restoreFocus(target: Element | null) {
	if (!(target instanceof HTMLElement) || target === document.body) return
	if (target.isConnected) {
		target.focus()
		return
	}
	const active = document.activeElement
	if (active && active !== document.body && active.isConnected) return
	const fallback =
		counterpartOf(target) ??
		document.querySelector<HTMLElement>(`main :is(${FOCUSABLE})`)
	fallback?.focus()
}

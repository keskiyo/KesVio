import { type RefObject, useEffect, useRef } from 'react'
import { type CardDirection, nextCardIndex } from '../lib/cardNavigation'

const LAUNCH_TARGET = '[data-launch-target]'

const DIRECTIONS: Partial<Record<string, CardDirection>> = {
	ArrowLeft: 'left',
	ArrowRight: 'right',
	ArrowUp: 'up',
	ArrowDown: 'down',
}

interface CardNavigationOptions {
	containerRef: RefObject<HTMLElement | null>
	onLeaveTop(): void
	onElevate(appId: string): void
}

function launchTargets(container: HTMLElement) {
	return [
		...container.querySelectorAll<HTMLElement>(
			`${LAUNCH_TARGET}:not(:disabled)`,
		),
	]
}

function reveal(target: HTMLElement | undefined) {
	target?.focus()
	target?.scrollIntoView({ block: 'nearest' })
}

export function focusFirstLaunchTarget(container: HTMLElement | null) {
	if (container) reveal(launchTargets(container)[0])
}

export function useCardNavigation({
	containerRef,
	onLeaveTop,
	onElevate,
}: CardNavigationOptions) {
	const latest = useRef({ onLeaveTop, onElevate })
	latest.current = { onLeaveTop, onElevate }

	useEffect(() => {
		const element = containerRef.current
		if (!element) return
		const container: HTMLElement = element
		function onKeyDown(event: KeyboardEvent) {
			const target =
				event.target instanceof HTMLElement
					? event.target.closest<HTMLElement>(LAUNCH_TARGET)
					: null
			if (!target || event.altKey || event.metaKey) return
			if (event.key === 'Enter' && event.ctrlKey) {
				const id = target.dataset.appId
				if (!id) return
				event.preventDefault()
				latest.current.onElevate(id)
				return
			}
			const direction = DIRECTIONS[event.key]
			if (!direction || event.ctrlKey || event.shiftKey) return
			event.preventDefault()
			const targets = launchTargets(container)
			const next = nextCardIndex(
				targets.map(element => element.getBoundingClientRect()),
				targets.indexOf(target),
				direction,
			)
			if (next !== null) reveal(targets[next])
			else if (direction === 'up') latest.current.onLeaveTop()
		}
		container.addEventListener('keydown', onKeyDown)
		return () => container.removeEventListener('keydown', onKeyDown)
	}, [containerRef])
}

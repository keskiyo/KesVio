import type { KeyboardEvent, RefObject } from 'react'
import { RUN_TARGET } from './data'

interface LauncherKeysOptions {
	dialogRef: RefObject<HTMLDivElement>
	inputRef: RefObject<HTMLInputElement>
	onClose(): void
	onExpandActive(index: number, open: boolean): void
}

function runTargets(dialog: HTMLElement | null): HTMLButtonElement[] {
	return dialog
		? [...dialog.querySelectorAll<HTMLButtonElement>(`[${RUN_TARGET}]`)]
		: []
}

function isPrintable(event: KeyboardEvent): boolean {
	return (
		event.key.length === 1 &&
		!event.ctrlKey &&
		!event.metaKey &&
		!event.altKey
	)
}

export function createLauncherKeyHandler({
	dialogRef,
	inputRef,
	onClose,
	onExpandActive,
}: LauncherKeysOptions) {
	return function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key === 'Escape') {
			event.preventDefault()
			onClose()
			return
		}
		const targets = runTargets(dialogRef.current)
		if (targets.length === 0) return
		const current = targets.findIndex(target => target === event.target)
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault()
			const step = event.key === 'ArrowDown' ? 1 : -1
			const first = step > 0 ? 0 : targets.length - 1
			const next =
				current < 0
					? first
					: (current + step + targets.length) % targets.length
			targets[next].focus()
			return
		}
		if (current < 0) return
		if (event.key === 'Home' || event.key === 'End') {
			event.preventDefault()
			targets[event.key === 'Home' ? 0 : targets.length - 1].focus()
			return
		}
		if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
			event.preventDefault()
			onExpandActive(current, event.key === 'ArrowRight')
			return
		}
		if (isPrintable(event)) inputRef.current?.focus()
	}
}

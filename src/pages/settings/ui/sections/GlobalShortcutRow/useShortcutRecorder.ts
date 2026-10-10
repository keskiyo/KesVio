import { useEffect, useState } from 'react'
import type { GlobalShortcutBinding } from '../../../../../entities/system'
import { readCapture } from './binding'
import { DEFAULT_BINDING } from './data'
import type { CaptureProblem } from './types'

export function useShortcutRecorder(
	onSave: (binding: GlobalShortcutBinding) => Promise<void>,
) {
	const [recording, setRecording] = useState(false)
	const [problem, setProblem] = useState<CaptureProblem | null>(null)
	const [candidate, setCandidate] = useState<GlobalShortcutBinding | null>(
		null,
	)
	const [attempt, setAttempt] = useState<GlobalShortcutBinding | null>(null)

	useEffect(() => {
		if (!recording) return
		function finish() {
			setRecording(false)
			setProblem(null)
		}
		function onKeyDown(event: KeyboardEvent) {
			const result = readCapture(event)
			if (result.kind === 'pass') return
			event.preventDefault()
			event.stopPropagation()
			if (result.kind === 'cancel') finish()
			else if (result.kind === 'reset') {
				finish()
				setAttempt(DEFAULT_BINDING)
				void onSave(DEFAULT_BINDING)
			} else if (result.kind === 'binding') {
				finish()
				setCandidate(result.binding)
			} else if (result.kind !== 'hold') setProblem(result)
		}
		window.addEventListener('keydown', onKeyDown, { capture: true })
		return () =>
			window.removeEventListener('keydown', onKeyDown, { capture: true })
	}, [recording, onSave])

	function start() {
		setRecording(true)
		setProblem(null)
	}

	function stop() {
		setRecording(false)
		setProblem(null)
	}

	function confirm() {
		if (!candidate) return
		setCandidate(null)
		setAttempt(candidate)
		void onSave(candidate)
	}

	function dismiss() {
		setCandidate(null)
	}

	return {
		recording,
		problem,
		candidate,
		attempt,
		start,
		stop,
		confirm,
		dismiss,
	}
}

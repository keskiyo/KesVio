import { useEffect, useId, useRef } from 'react'
import type { BackupConfirmationProps } from '../types'

export function BackupConfirmation({
	question,
	confirmLabel,
	returnFocusRef,
	onCancel,
	onConfirm,
}: BackupConfirmationProps) {
	const confirmationRef = useRef<HTMLDivElement>(null)
	const questionId = useId()

	useEffect(() => {
		confirmationRef.current?.focus()
	}, [])

	function cancel() {
		onCancel()
		returnFocusRef.current?.focus()
	}

	return (
		<div
			ref={confirmationRef}
			role="group"
			tabIndex={-1}
			aria-labelledby={questionId}
			className="mt-4 flex flex-col gap-3 rounded-xl border border-violet-400/35 bg-violet-500/8 p-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 sm:flex-row sm:items-center"
		>
			<p
				id={questionId}
				className="min-w-0 text-sm leading-6 text-slate-700 sm:flex-1"
			>
				{question}
			</p>
			<div className="grid grid-cols-2 gap-3 sm:flex sm:shrink-0">
				<button
					type="button"
					onClick={cancel}
					className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-(--surface-raised) focus-visible:outline-2 focus-visible:outline-violet-500"
				>
					Cancel
				</button>
				<button
					type="button"
					onClick={onConfirm}
					className="utility-accent-button rounded-lg px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-violet-500"
				>
					{confirmLabel}
				</button>
			</div>
		</div>
	)
}

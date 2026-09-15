import { Filter, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
	EMPTY_CRITERIA,
	MAX_SAVED_FILTER_NAME_LENGTH,
	type SavedFilterCriteria,
} from '../../../../entities/app'
import { useModalDialog } from '../../../../shared/hooks/useModalDialog'
import { useSpotlight } from '../../../../shared/hooks/useSpotlight'
import { SpotlightLayer } from '../../../../shared/ui/SpotlightLayer'
import { CriteriaFieldset } from './CriteriaFieldset'
import { FIELD_LABEL_CLASS } from './data'
import { SavedFilterActions } from './SavedFilterActions'
import type { SavedFilterDialogProps } from './types'

export function SavedFilterDialog({
	filter,
	publishers,
	onSave,
	onDelete,
	onClose,
}: SavedFilterDialogProps) {
	const dialogRef = useRef<HTMLElement>(null)
	const nameRef = useRef<HTMLInputElement>(null)
	const [name, setName] = useState(filter?.name ?? '')
	const [criteria, setCriteria] = useState<SavedFilterCriteria>(
		filter?.criteria ?? EMPTY_CRITERIA,
	)
	const [error, setError] = useState<string | null>(null)
	const nameSpotlight = useSpotlight()
	useModalDialog({
		ref: dialogRef,
		initialFocusRef: nameRef,
		onDismiss: onClose,
	})

	function save() {
		const result = onSave(name, criteria)
		if (result.ok) onClose()
		else setError(result.error)
	}

	return createPortal(
		<div className="motion-overlay fixed inset-0 z-500 grid place-items-center bg-slate-700/40 p-2 backdrop-blur-[2px] min-[420px]:p-4">
			<section
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="saved-filter-title"
				className="motion-panel flex max-h-[calc(100dvh-1rem)] w-[min(40rem,calc(100vw-1rem))] flex-col rounded-2xl border border-(--border-neutral) bg-(--surface-panel) p-4 text-(--text-primary) shadow-(--shadow-dialog) min-[420px]:max-h-[calc(100dvh-2rem)] min-[420px]:p-5"
			>
				<header className="flex items-start gap-3">
					<span className="grid size-10 shrink-0 place-items-center rounded-xl border border-(--border-neutral) bg-(--surface-inset)">
						<Filter size={19} aria-hidden="true" />
					</span>
					<div className="min-w-0 flex-1">
						<h2
							id="saved-filter-title"
							className="text-base font-semibold break-words"
						>
							{filter ? 'Edit filter' : 'New filter'}
						</h2>
						<p className="mt-2 text-sm leading-6 text-(--text-muted)">
							All chosen fields apply together. Leave everything
							empty to show the whole view.
						</p>
					</div>
					<button
						type="button"
						aria-label="Close"
						onClick={onClose}
						className="grid size-8 shrink-0 place-items-center rounded-lg text-(--text-muted) hover:bg-(--surface-raised) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong)"
					>
						<X size={16} aria-hidden="true" />
					</button>
				</header>
				<form
					className="mt-4 flex min-h-0 flex-1 flex-col"
					onSubmit={event => {
						event.preventDefault()
						save()
					}}
				>
					<div className="grid min-h-0 flex-1 gap-4 overflow-y-auto pr-1 pb-2">
						<label className="grid gap-1.5">
							<span className={FIELD_LABEL_CLASS}>Name</span>
							<span
								className="relative rounded-xl"
								onPointerMove={nameSpotlight.onPointerMove}
								onPointerEnter={nameSpotlight.onPointerEnter}
								onPointerLeave={nameSpotlight.onPointerLeave}
							>
								<SpotlightLayer size={150} />
								<input
									ref={nameRef}
									type="text"
									value={name}
									maxLength={MAX_SAVED_FILTER_NAME_LENGTH}
									autoComplete="off"
									spellCheck={false}
									onChange={event =>
										setName(event.target.value)
									}
									className="search-input h-11 w-full rounded-xl border border-(--border-neutral) bg-(--surface-inset) px-3 text-sm text-(--text-primary) outline-none"
								/>
							</span>
						</label>
						<CriteriaFieldset
							criteria={criteria}
							publishers={publishers}
							onChange={setCriteria}
						/>
						{error && (
							<p role="alert" className="text-sm text-red-700">
								{error}
							</p>
						)}
					</div>
					<SavedFilterActions
						editing={Boolean(filter)}
						onDelete={onDelete}
						onClose={onClose}
					/>
				</form>
			</section>
		</div>,
		document.querySelector<HTMLElement>('.app-shell') ?? document.body,
	)
}

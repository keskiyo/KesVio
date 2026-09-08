import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useModalDialog } from '../../../../shared/hooks/useModalDialog'
import { useScenarioFilters } from '../../model/useScenarioFilters'
import { DIALOG_LABEL, LIST_ID } from './data'
import { createLauncherKeyHandler } from './launcherKeys'
import { ScenarioLauncherHeader } from './ScenarioLauncherHeader'
import { ScenarioLauncherEmpty } from './ScenarioLauncherEmpty'
import { ScenarioRunRow } from './ScenarioRunRow'
import type { ScenarioRunDialogProps } from './types'

export function ScenarioRunDialog({
	scenarios,
	apps,
	favoriteScenarioIds,
	runningId,
	isScenarioRunning,
	runningStatus,
	onRun,
	onToggleFavorite,
	onClose,
}: ScenarioRunDialogProps) {
	const dialogRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)
	const closeRef = useRef<HTMLButtonElement>(null)
	const [expanded, setExpanded] = useState<string[]>([])
	const filters = useScenarioFilters({ scenarios, apps, favoriteScenarioIds })
	useModalDialog({ ref: dialogRef, initialFocusRef: inputRef })

	function toggle(id: string, open?: boolean) {
		setExpanded(current => {
			const isOpen = current.includes(id)
			const next = open ?? !isOpen
			if (next === isOpen) return current
			return next
				? [...current, id]
				: current.filter(entry => entry !== id)
		})
	}

	const onKeyDown = createLauncherKeyHandler({
		dialogRef,
		inputRef,
		onClose,
		onExpandActive: (index, open) => {
			const scenario = filters.results[index]
			if (scenario) toggle(scenario.id, open)
		},
	})

	function reset() {
		filters.reset()
		inputRef.current?.focus()
	}

	return createPortal(
		<div
			className="motion-overlay fixed inset-0 z-500 grid place-items-center bg-slate-700/40 px-4 backdrop-blur-[2px]"
			onMouseDown={event => {
				if (event.currentTarget === event.target) onClose()
			}}
		>
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-label={DIALOG_LABEL}
				tabIndex={-1}
				onKeyDown={onKeyDown}
				className="motion-panel flex max-h-[min(48rem,calc(100vh-4rem))] w-[min(52rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-(--border-neutral) bg-(--surface-panel) shadow-(--shadow-palette)"
			>
				<ScenarioLauncherHeader
					query={filters.query}
					inputRef={inputRef}
					closeRef={closeRef}
					filters={{
						filter: filters.filter,
						sort: filters.sort,
						reversed: filters.reversed,
						counts: filters.counts,
						onFilterChange: filters.setFilter,
						onSortChange: filters.setSort,
						onToggleSortDirection: filters.toggleSortDirection,
					}}
					onQueryChange={filters.setQuery}
					onClose={onClose}
				/>
				{filters.results.length === 0 ? (
					<ScenarioLauncherEmpty
						filtered={filters.isFiltered}
						onReset={reset}
					/>
				) : (
					<ul
						id={LIST_ID}
						aria-label="Scenarios"
						className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
					>
						{filters.results.map(scenario => (
							<ScenarioRunRow
								key={scenario.id}
								scenario={scenario}
								apps={apps}
								expanded={expanded.includes(scenario.id)}
								running={runningId === scenario.id}
								isFavorite={favoriteScenarioIds.includes(
									scenario.id,
								)}
								isScenarioRunning={isScenarioRunning}
								runningStatus={runningStatus}
								onToggle={toggle}
								onRun={onRun}
								onToggleFavorite={onToggleFavorite}
							/>
						))}
					</ul>
				)}
				<p className="border-t border-(--border-neutral) px-4 py-2 text-xs text-(--text-muted)">
					↑↓ to move between scenarios, Enter to run, Esc to close.
				</p>
			</div>
		</div>,
		document.body,
	)
}

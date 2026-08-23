import { useCallback, useEffect, useRef, useState } from 'react'
import { useTileRowLimit } from '../../../../shared/hooks/useTileRowLimit'
import { ScenarioAppTile } from '../ScenarioAppTile'
import { UnavailableScenarioAppTile } from '../UnavailableScenarioAppTile'
import type { ScenarioTileRowProps } from './types'

const BADGE_ROOM = 6

export function ScenarioTileRow({
	label,
	scenarioName,
	apps,
	unavailable,
	listClassName,
	collapsible = false,
	disabled = false,
	markOf,
	onRemove,
	identityOf,
}: ScenarioTileRowProps) {
	const [expanded, setExpanded] = useState(false)
	const total = apps.length + unavailable.length
	const { ref, fitted, rowEnd, rowHeight, fullHeight } =
		useTileRowLimit(total)
	const overflowing = collapsible && fitted > 0 && total > fitted
	const counting = overflowing && !expanded
	const listRef = useRef<HTMLUListElement | null>(null)
	const attachList = useCallback(
		(node: HTMLUListElement | null) => {
			listRef.current = node
			ref(node)
		},
		[ref],
	)

	useEffect(() => {
		const reachable = counting ? fitted : total
		for (const [index, tile] of [
			...(listRef.current?.children ?? []),
		].entries())
			tile.toggleAttribute('inert', index >= reachable)
	}, [counting, fitted, total])

	const removal = (name: string, identity: string) =>
		onRemove && {
			label: `Remove ${name} from the ${label} list of ${scenarioName}`,
			disabled,
			onRemove: () => onRemove(identity),
		}

	return (
		<div className="flex min-w-0 flex-1 flex-col gap-1">
			<div className="min-w-0">
				<div
					className={`relative -my-1.5 min-w-0 overflow-hidden py-1.5 transition-[height] duration-(--motion-medium) ease-(--motion-ease-out) motion-reduce:transition-none ${counting ? 'pr-10' : ''}`}
					style={
						overflowing && rowHeight > 0
							? {
									height:
										(expanded ? fullHeight : rowHeight) +
										BADGE_ROOM * 2,
								}
							: undefined
					}
				>
					<ul
						ref={attachList}
						aria-label={`${label} list of ${scenarioName}`}
						className={listClassName}
					>
						{apps.map(app => (
							<ScenarioAppTile
								key={app.id}
								app={app}
								mark={markOf?.(app) ?? null}
								remove={
									removal(
										app.name,
										identityOf?.(app) ?? app.id,
									) || undefined
								}
							/>
						))}
						{unavailable.map(entry => (
							<UnavailableScenarioAppTile
								key={entry.identity}
								entry={entry}
								remove={
									removal(entry.name, entry.identity) ||
									undefined
								}
							/>
						))}
					</ul>
					{counting && (
						<span
							aria-hidden="true"
							style={{ left: rowEnd }}
							className="pointer-events-none absolute inset-y-0 right-0 flex items-center justify-center text-sm font-medium text-(--text-muted)"
						>
							+{total - fitted}
						</span>
					)}
				</div>
			</div>
			{overflowing && (
				<button
					type="button"
					onClick={() => setExpanded(current => !current)}
					style={{ fontSize: '10px', lineHeight: '14px' }}
					className="self-start rounded px-2 font-medium text-(--text-muted) underline decoration-(--border-neutral) underline-offset-2 transition-colors hover:text-(--text-primary) hover:decoration-(--accent) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong)"
				>
					{expanded ? 'Show less' : `Show all ${total}`}
				</button>
			)}
		</div>
	)
}

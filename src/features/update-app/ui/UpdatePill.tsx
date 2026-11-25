import type { CSSProperties } from 'react'
import { Download } from 'lucide-react'
import {
	isUpdateInstalling,
	updateProgressLabel,
} from '../lib/updatePresentation'
import type { UpdatePillProps } from '../types'

const PILL =
	'inline-flex h-5 items-center gap-1.5 rounded-full border pr-2 pl-1.5 text-(--text-primary)'
const LABEL = 'truncate text-[0.72rem] leading-4 font-medium'
const FOCUS =
	'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent-strong)'

export function UpdatePill({
	version,
	phase,
	progress,
	className = '',
	onInstall,
}: UpdatePillProps) {
	if (isUpdateInstalling(phase)) {
		const label = updateProgressLabel(phase, progress)
		const filled = phase === 'downloading' ? (progress ?? 0) : 100
		return (
			<div
				role="progressbar"
				aria-label={`Installing update ${version}`}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={
					phase === 'downloading' && progress === null
						? undefined
						: filled
				}
				aria-valuetext={label}
				style={{ '--update-progress': `${filled}%` } as CSSProperties}
				className={`${className} ${PILL} update-pill-progress w-40 border-(--accent)/45`}
			>
				<span className={LABEL}>{label}</span>
			</div>
		)
	}
	const failed = phase === 'failed'
	return (
		<button
			type="button"
			onClick={onInstall}
			title="Download, install and restart KesVio"
			className={`${className} ${PILL} ${FOCUS} ${
				failed
					? 'border-rose-400/50 bg-rose-500/18 hover:bg-rose-500/28'
					: 'border-(--accent)/45 bg-(--accent)/22 hover:bg-(--accent)/32'
			}`}
		>
			<Download size={13} aria-hidden="true" className="shrink-0" />
			<span className={LABEL}>
				{failed
					? `Retry update ${version}`
					: `Update ${version} available`}
			</span>
		</button>
	)
}

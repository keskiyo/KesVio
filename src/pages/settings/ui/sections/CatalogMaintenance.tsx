import { RefreshCw, RotateCcw, ScanSearch } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { MaintenanceConfirmation } from '../../../../features/edit-settings'
import { SettingsSectionHeader } from '../components/SettingsSectionHeader'
import { DANGER_VARIANT } from '../../../../shared/ui/buttonVariants'
import {
	ACTION_BUTTON,
	ACTION_BUTTON_PRIMARY,
	ACTION_ROW,
	CANCEL_BUTTON,
	CONFIRM_BUTTON,
} from '../../data'
import type { CatalogMaintenanceProps } from '../../types'

export function CatalogMaintenance({
	forcing,
	resetting,
	confirming,
	canReset,
	setConfirming,
	onForceFullScan,
	onResetCatalogCache,
}: CatalogMaintenanceProps) {
	const forceTriggerRef = useRef<HTMLButtonElement>(null)
	const resetTriggerRef = useRef<HTMLButtonElement>(null)
	const previousConfirming = useRef<MaintenanceConfirmation>(null)
	useEffect(() => {
		const dismissed = previousConfirming.current
		previousConfirming.current = confirming
		if (!dismissed || dismissed === confirming) return
		if (confirming === null)
			(dismissed === 'force'
				? forceTriggerRef
				: resetTriggerRef
			).current?.focus()
	}, [confirming])

	return (
		<div className="settings-surface flex flex-col rounded-2xl border border-white/85 bg-white/58 p-5">
			<div className="flex items-start gap-4">
				<SettingsSectionHeader
					icon={RefreshCw}
					title="Catalog maintenance"
					description="Rebuild the application catalog."
				/>
			</div>
			<div className={`mt-auto pt-4 ${ACTION_ROW}`}>
				<button
					ref={forceTriggerRef}
					type="button"
					disabled={forcing || resetting}
					onClick={() => setConfirming('force')}
					className={ACTION_BUTTON_PRIMARY}
				>
					<ScanSearch size={16} aria-hidden="true" />
					Force full scan
				</button>
				{canReset && (
					<button
						ref={resetTriggerRef}
						type="button"
						disabled={forcing || resetting}
						onClick={() => setConfirming('reset')}
						className={`${ACTION_BUTTON} ${DANGER_VARIANT}`}
					>
						<RotateCcw size={16} aria-hidden="true" />
						Reset catalog cache
					</button>
				)}
			</div>
			{confirming === 'force' && (
				<div
					role="dialog"
					aria-label="Confirm full scan"
					className="mt-4 flex flex-col gap-3 rounded-xl border border-violet-400/35 bg-violet-500/8 p-4 shadow-inner shadow-violet-950/10"
				>
					<p className="text-sm leading-6 text-slate-700">
						The next scan will take longer than an incremental
						refresh.
					</p>
					<div className={ACTION_ROW}>
						<button
							type="button"
							disabled={forcing}
							onClick={() => setConfirming(null)}
							className={CANCEL_BUTTON}
						>
							Cancel
						</button>
						<button
							type="button"
							disabled={forcing}
							onClick={() => void onForceFullScan()}
							className={`${CONFIRM_BUTTON} utility-accent-button text-white focus-visible:outline-violet-300`}
						>
							{forcing ? 'Scanning…' : 'Confirm full scan'}
						</button>
					</div>
				</div>
			)}
			{confirming === 'reset' && (
				<div
					role="dialog"
					aria-label="Confirm catalog cache reset"
					className="danger-panel mt-4 flex flex-col gap-3 rounded-xl border border-red-300/70 bg-red-50 p-4"
				>
					<p className="text-sm leading-6 text-red-800">
						This removes the local app cache and icon cache, then
						scans every configured location again. Favorites, Hidden
						apps and categories are preserved.
					</p>
					<div className={ACTION_ROW}>
						<button
							type="button"
							disabled={resetting}
							onClick={() => setConfirming(null)}
							className={CANCEL_BUTTON}
						>
							Cancel
						</button>
						<button
							type="button"
							disabled={resetting}
							onClick={() => void onResetCatalogCache()}
							className={`${CONFIRM_BUTTON} ${DANGER_VARIANT}`}
						>
							<RotateCcw size={16} aria-hidden="true" />
							{resetting ? 'Resetting…' : 'Confirm reset'}
						</button>
					</div>
				</div>
			)}
		</div>
	)
}

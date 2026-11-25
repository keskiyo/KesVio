import { useCallback } from 'react'
import { toast } from 'sonner'
import {
	assessCatalogHealth,
	type CatalogDiagnostics,
} from '../../entities/app'
import { toAppClientError } from '../../shared/api/tauri/errors'

export interface ScanFeedbackOptions {
	onRefresh(): Promise<CatalogDiagnostics | null | void>
	onFullScan(): Promise<CatalogDiagnostics | null | void>
	onOpenCatalogHealth?(): void
}

export function reportScanCompletion(
	diagnostics: CatalogDiagnostics | null | void,
	onOpenCatalogHealth: (() => void) | undefined,
	successMessage: string,
) {
	const state = assessCatalogHealth(diagnostics ?? null, false).state
	if (state === 'attention' || state === 'unverified') {
		toast.warning(
			state === 'attention'
				? 'Catalog partially refreshed'
				: 'Catalog source status unavailable',
			{
				action: onOpenCatalogHealth
					? { label: 'Catalog Health', onClick: onOpenCatalogHealth }
					: undefined,
			},
		)
	} else {
		toast.success(successMessage)
	}
}

async function reportScan(run: () => Promise<void>) {
	try {
		await run()
	} catch (error) {
		const { code } = toAppClientError(error)
		if (code === 'SCAN_CANCELLED') toast.info('Application scan cancelled')
		else toast.error(`Could not refresh the application list (${code})`)
	}
}

export function useScanFeedback({
	onRefresh,
	onFullScan,
	onOpenCatalogHealth,
}: ScanFeedbackOptions) {
	const refresh = useCallback(
		() =>
			reportScan(async () =>
				reportScanCompletion(
					await onRefresh(),
					onOpenCatalogHealth,
					'Application list refreshed',
				),
			),
		[onRefresh, onOpenCatalogHealth],
	)
	const confirmedFullScan = useCallback(async () => {
		reportScanCompletion(
			await onFullScan(),
			onOpenCatalogHealth,
			'Application list refreshed',
		)
	}, [onFullScan, onOpenCatalogHealth])
	const fullScan = useCallback(
		() => reportScan(confirmedFullScan),
		[confirmedFullScan],
	)
	return { refresh, fullScan, confirmedFullScan }
}

import { useEffect } from 'react'
import { toast } from 'sonner'
import { catalogChangeMessage } from '../../widgets/catalog-content'
import type { CatalogChangeSummary } from '../../entities/app'

interface CatalogChangeToastInput {
	catalogChange: CatalogChangeSummary | null
	isRefreshing: boolean
	clearCatalogChange(): void
}

export function useCatalogChangeToast({
	catalogChange,
	isRefreshing,
	clearCatalogChange,
}: CatalogChangeToastInput) {
	useEffect(() => {
		if (!catalogChange) return
		if (!isRefreshing) {
			const message = catalogChangeMessage(catalogChange)
			if (message) toast.success(message)
		}
		clearCatalogChange()
	}, [catalogChange, clearCatalogChange, isRefreshing])
}

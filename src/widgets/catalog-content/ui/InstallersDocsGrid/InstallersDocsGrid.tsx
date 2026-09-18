import { Box, FileText, Package, SearchX } from 'lucide-react'
import { ArtifactSection } from './ArtifactSection'
import { CatalogViewHeader } from '../CatalogViewHeader'
import { ViewEmptyState } from '../ViewEmptyState'
import type { InstallersDocsGridProps } from './types'

export function InstallersDocsGrid({
	apps,
	hasQuery,
	onBack,
	...actions
}: InstallersDocsGridProps) {
	const installers = []
	const docs = []
	for (const app of apps) {
		if (app.artifactKind === 'installer') installers.push(app)
		if (app.artifactKind === 'documentation') docs.push(app)
	}
	const back = { label: 'Back to More', onBack }
	return (
		<section aria-labelledby="installers-docs-title">
			<CatalogViewHeader
				icon={Box}
				title="Installers & Docs"
				titleId="installers-docs-title"
				count={apps.length}
				noun="item"
				description="Setup packages and documentation found while scanning."
				back={back}
			/>
			{apps.length ? (
				<div className="mx-auto max-w-3xl space-y-8 min-[1900px]:max-w-[80rem]">
					{installers.length > 0 && (
						<ArtifactSection
							icon={Package}
							title="Installers"
							apps={installers}
							{...actions}
						/>
					)}
					{docs.length > 0 && (
						<ArtifactSection
							icon={FileText}
							title="Documentation"
							apps={docs}
							{...actions}
						/>
					)}
				</div>
			) : hasQuery ? (
				<ViewEmptyState
					icon={SearchX}
					title="No matching installers or docs"
					description="Try a different search."
				/>
			) : (
				<ViewEmptyState
					icon={Box}
					title="No installers or docs found"
					description="Refresh the catalog to scan supported locations."
					back={back}
				/>
			)}
		</section>
	)
}

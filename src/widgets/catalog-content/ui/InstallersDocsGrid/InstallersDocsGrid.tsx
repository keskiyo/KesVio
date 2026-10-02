import { Box, FileText, Package, SearchX } from 'lucide-react'
import { useMemo } from 'react'
import { newerInstalledVersions } from '../../../../entities/app'
import { APP_ROW_PAGE } from '../AppRow/data'
import { ArtifactSection } from './ArtifactSection'
import { CatalogViewHeader } from '../CatalogViewHeader'
import { ViewEmptyState } from '../ViewEmptyState'
import type { InstallersDocsGridProps } from './types'

export function InstallersDocsGrid({
	apps,
	installedApps,
	hasQuery,
	onBack,
	...actions
}: InstallersDocsGridProps) {
	const installers = apps.filter(app => app.artifactKind === 'installer')
	const docs = apps.filter(app => app.artifactKind === 'documentation')
	const newerInstalled = useMemo(
		() =>
			newerInstalledVersions(
				apps.filter(app => app.artifactKind === 'installer'),
				installedApps,
			),
		[apps, installedApps],
	)
	const back = { label: 'Back to More', onBack }
	return (
		<section
			aria-labelledby="installers-docs-title"
			className={APP_ROW_PAGE}
		>
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
				<div className="space-y-8">
					{installers.length > 0 && (
						<ArtifactSection
							icon={Package}
							title="Installers"
							apps={installers}
							newerInstalled={newerInstalled}
							{...actions}
						/>
					)}
					{docs.length > 0 && (
						<ArtifactSection
							icon={FileText}
							title="Documentation"
							apps={docs}
							newerInstalled={newerInstalled}
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

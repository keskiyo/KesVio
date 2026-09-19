export type {
	AppArchitecture,
	AppArtifactKind,
	AppDetails,
	AppHydrationPatch,
	AppInfo,
	AppLaunchKind,
	AppPlatformKind,
	AppSignatureStatus,
	AppSourceKind,
	AppsClient,
	AppView,
	CatalogArtifactKind,
	CatalogChangeSummary,
	CatalogDelta,
	CatalogDiagnostics,
	CatalogScanResult,
	CatalogSnapshot,
	CloseAppsResult,
	CloseProgress,
	LaunchStatus,
	ScanProgress,
	SourceErrorKind,
	SourceHealth,
	SourceHealthState,
	TargetAvailabilityDiff,
} from './model/app.types'
export {
	type AppPredicate,
	type CatalogCounts,
	createMarkLookup,
	filterVisibleApps,
	selectCatalogCounts,
	selectRecentApps,
	selectUnclassifiedApps,
	selectSearchScopeCounts,
	type SearchScopeCounts,
} from './model/catalogSelectors'
export { appIdentity } from './lib/appIdentity'
export { isCatalogView } from './lib/appView'
export { deduplicateVisibleApps } from './lib/appDeduplication'
export {
	classificationReasonsLabel,
	descriptionLabel,
	displayVersion,
	metadataRows,
	SOURCE_LABELS,
	targetAvailabilityLabel,
} from './lib/appMetadata'
export {
	buildAppReport,
	formatFileDate,
	formatFileSize,
} from './lib/appFileDetails'
export { categoryReasonsLabel } from './lib/categoryReason'
export { joinHydrationIds, splitHydrationIds } from './lib/hydrationIds'
export {
	closeBlockedMessage,
	closeRiskBadge,
	closeRiskReason,
	closeRiskWarning,
	isCloseBlocked,
	type CloseRiskBadge,
} from './lib/closeRisk'
export {
	getDropAction,
	groupAppsByCategory,
	sortFavoritesFirst,
	type DragData,
	type DropAction,
} from './lib/catalog'
export {
	INSTALLERS_DOCS_CATEGORY,
	isCatalogArtifact,
	isInstaller,
} from './lib/catalogArtifacts'
export {
	CATALOG_DENSITIES,
	type CatalogDensity,
	DEFAULT_CATALOG_DENSITY,
} from './lib/catalogDensity'
export {
	filterAppsByQuery,
	rankAppsByQuery,
	rankAppsByQueryAndCategory,
	rankAppsByQueryTop,
} from './lib/catalogSearch'
export { loadKnownPackageIndex } from './lib/search/knownPackageIndex'
export { type SearchIndex, useSearchIndex } from './model/useSearchIndex'
export {
	ADDED_WITHIN_CHOICES,
	applySavedFilter,
	AVAILABILITY_BUCKET_LABELS,
	AVAILABILITY_BUCKETS,
	availabilityBucket,
	type AvailabilityBucket,
	catalogPublishers,
	EMPTY_CRITERIA,
	isEmptyCriteria,
	matchesSavedFilter,
	savedFilterSources,
	MAX_SAVED_FILTER_NAME_LENGTH,
	MAX_SAVED_FILTERS,
	normalizeCriteria,
	normalizeSavedFilter,
	SAVED_FILTER_SOURCES,
	type SavedFilter,
	type SavedFilterCriteria,
} from './lib/savedFilters'
export {
	assessCatalogHealth,
	type CatalogHealthState,
	type CatalogHealthStatus,
} from './lib/catalogHealth'
export {
	describeSourceHealth,
	type SourceHealthSummary,
	type SourceStatus,
	type SourceStatusRow,
	sourceLabel,
	summarizeSourceHealth,
} from './lib/sourceHealth'
export { AppCard } from './ui/AppCard/AppCard'
export { CardIcon } from './ui/AppCard/CardIcon'

export {
	type CategorizedAppsState,
	selectCategorizedApps,
} from './model/categorizedApps'

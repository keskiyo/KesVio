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
	AppVisibilityReason,
	CatalogArtifactKind,
	CatalogChangeSummary,
	CatalogDelta,
	CatalogDiagnostics,
	CatalogScanResult,
	CatalogSnapshot,
	CloseAppsResult,
	CloseProgress,
	FolderSize,
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
	visibilityReasonLabel,
} from './lib/appMetadata'
export { auxiliaryReason } from './lib/auxiliaryReason'
export {
	type AppVersionGroup,
	groupAppVersions,
	newerInstalledVersions,
} from './lib/versionGroups'
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
	canOpenFolderFromMenu,
	type ElevationSupport,
	elevationSupport,
} from './lib/elevation'
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
export {
	type AppLaunchStat,
	type AppLaunchStats,
	MAX_LAUNCH_STATS,
	normalizeLaunchStats,
	rankByFrecency,
	recordLaunchStat,
} from './lib/launchHistory'
export { type SearchIndex, useSearchIndex } from './model/useSearchIndex'
export {
	ADDED_WITHIN_CHOICES,
	AVAILABILITY_BUCKET_LABELS,
	AVAILABILITY_BUCKETS,
	type AvailabilityBucket,
	catalogPublishers,
	EMPTY_CRITERIA,
	isEmptyCriteria,
	MAX_SAVED_FILTER_NAME_LENGTH,
	MAX_SAVED_FILTERS,
	normalizeCriteria,
	normalizeSavedFilter,
	SAVED_FILTER_SOURCES,
	type SavedFilter,
	type SavedFilterCriteria,
	UNUSED_FOR_CHOICES,
} from './lib/savedFilters'
export {
	applySavedFilter,
	availabilityBucket,
	matchesSavedFilter,
	savedFilterSources,
	type SavedFilterUsage,
} from './lib/savedFilterMatch'
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

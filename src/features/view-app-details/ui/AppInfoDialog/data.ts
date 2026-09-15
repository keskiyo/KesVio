import {
	type AppInfo,
	categoryReasonsLabel,
	classificationReasonsLabel,
	SOURCE_LABELS,
	targetAvailabilityLabel,
} from '../../../../entities/app'
import { driveCategoryFor } from '../../../../entities/category'

const FOLDER_IDENTITY = /^\{[0-9a-fA-F-]{36}\}\\(.+)$/

export function launchTargetValue(app: AppInfo): string {
	if (app.launchKind !== 'app_user_model_id') return app.path
	const withinKnownFolder = FOLDER_IDENTITY.exec(app.path)
	return withinKnownFolder && app.installLocation?.trim()
		? withinKnownFolder[1]
		: app.path
}

const LAUNCH_TYPE_LABELS = {
	executable: 'Executable',
	shortcut: 'Shortcut',
	app_user_model_id: 'Windows app',
} as const

export function launchTypeLabel(app: AppInfo): string {
	return LAUNCH_TYPE_LABELS[app.launchKind]
}

function shownAs(app: AppInfo): string {
	if (driveCategoryFor(app)) return 'Main catalog — grouped by scan drive'
	if (app.userPlacedArtifact) return 'Installers & Docs — placed here by you'
	if (app.artifactKind === 'installer')
		return 'Installers & Docs — detected installer'
	if (app.artifactKind === 'documentation')
		return 'Installers & Docs — detected documentation'
	if (app.userPromoted) return 'Main catalog — shown in apps by you'
	const where =
		app.visibilityClass === 'auxiliary' ? 'Auxiliary tools' : 'Main catalog'
	const reasons = visibilityExplanation(app)
	return `${where} — ${reasons || 'Classification reason unavailable'}`
}

function fileTargetCheck(app: AppInfo): string | null {
	const reason = app.targetAvailability
	if (!reason || reason.startsWith('target.not_applicable.')) return null
	return targetAvailabilityLabel(reason)
}

export function buildDetectionRows(app: AppInfo): [string, string][] {
	const rows: [string, string][] = [['Source', SOURCE_LABELS[app.sourceKind]]]
	const original = app.originalFilename?.trim()
	if (original && original !== launchTargetValue(app)) {
		rows.push(['Original filename', original])
	}
	rows.push(['Shown as', shownAs(app)])
	const target = fileTargetCheck(app)
	if (target) rows.push(['Launch target check', target])
	const category = categoryExplanation(app)
	if (category) rows.push(['Category', category])
	return rows
}

function visibilityExplanation(app: AppInfo): string | null {
	const reasons = app.visibilityReasons ?? []
	if (
		reasons.includes('portable_candidate') &&
		reasons.includes('insufficient_launch_evidence')
	) {
		return 'This executable has no reliable product metadata yet.'
	}
	return classificationReasonsLabel(reasons)
}

function categoryExplanation(app: AppInfo): string | null {
	if (driveCategoryFor(app))
		return 'The scan drive determines this category. Manual category changes do not apply.'
	if (app.categoryReasons?.includes('default=no-signal')) {
		return 'Other — no category evidence'
	}
	return categoryReasonsLabel(app.categoryReasons)
}

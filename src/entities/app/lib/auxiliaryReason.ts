import type { AppInfo, AppVisibilityReason } from '../model/app.types'

const AUXILIARY_REASONS: readonly AppVisibilityReason[] = [
	'installer',
	'maintenance_executable',
	'framework_package',
	'runtime_directory',
	'product_component',
	'sdk_sample',
	'command_environment',
	'console_application',
	'shell_location_shortcut',
	'documentation_shortcut',
	'insufficient_launch_evidence',
]

export function auxiliaryReason(
	app: Pick<AppInfo, 'visibilityReasons'>,
): AppVisibilityReason | null {
	const reasons = app.visibilityReasons ?? []
	return AUXILIARY_REASONS.find(reason => reasons.includes(reason)) ?? null
}

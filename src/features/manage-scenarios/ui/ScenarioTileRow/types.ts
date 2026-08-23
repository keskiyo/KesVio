import type { AppInfo } from '../../../../entities/app'
import type { UnavailableScenarioApp } from '../../../../entities/scenario'
import type { CloseRiskMark } from '../../types'

export interface ScenarioTileRowProps {
	label: string
	scenarioName: string
	apps: AppInfo[]
	unavailable: UnavailableScenarioApp[]
	listClassName: string
	collapsible?: boolean
	disabled?: boolean
	markOf?(app: AppInfo): CloseRiskMark | null
	onRemove?(identity: string): void
	identityOf?(app: AppInfo): string
}

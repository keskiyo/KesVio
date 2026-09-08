import type { RefObject } from 'react'
import type { AppInfo } from '../../../../entities/app'
import type { Scenario } from '../../../../entities/scenario'
import type { UnavailableScenarioApp } from '../../../../entities/scenario'
import type { ScenarioFilterBarProps } from '../ScenarioFilterBar/types'

export interface ScenarioRunDialogProps {
	scenarios: Scenario[]
	apps: AppInfo[]
	favoriteScenarioIds: string[]
	runningId: string | null
	isScenarioRunning: boolean
	runningStatus?: string
	onRun(id: string): void
	onToggleFavorite(id: string): void
	onClose(): void
}

export interface ScenarioLauncherHeaderProps {
	query: string
	inputRef: RefObject<HTMLInputElement>
	closeRef: RefObject<HTMLButtonElement>
	filters: ScenarioFilterBarProps
	onQueryChange(value: string): void
	onClose(): void
}

export interface ScenarioRunRowProps {
	scenario: Scenario
	apps: AppInfo[]
	expanded: boolean
	running: boolean
	isFavorite: boolean
	isScenarioRunning: boolean
	runningStatus?: string
	onToggle(id: string): void
	onRun(id: string): void
	onToggleFavorite(id: string): void
}

export interface ScenarioAppStackProps {
	apps: AppInfo[]
	extra: number
}

export interface ScenarioRunListProps {
	label: string
	scenarioName: string
	apps: AppInfo[]
	unavailable: UnavailableScenarioApp[]
	collapsible?: boolean
}

import {
	type AppInfo,
	type AppView,
	isCatalogView,
} from '../../../entities/app'
import { resolveScenarioApps, type Scenario } from '../../../entities/scenario'
import type { MorePreview } from './morePreview'

interface ScenarioAppsInput {
	activeView: AppView
	scenarios: Scenario[]
	favoriteScenarioIds: string[]
	catalogApps: AppInfo[]
}

export function selectShownScenarioApps({
	activeView,
	scenarios,
	favoriteScenarioIds,
	catalogApps,
}: ScenarioAppsInput): AppInfo[] {
	const shown =
		activeView === 'favorites'
			? scenarios.filter(scenario =>
					favoriteScenarioIds.includes(scenario.id),
				)
			: activeView === 'scenarios' || activeView === 'more'
				? scenarios
				: []
	if (!shown.length) return []
	const identities = new Set(
		shown.flatMap(scenario => [
			...scenario.launchIdentities,
			...scenario.closeIdentities,
		]),
	)
	return resolveScenarioApps([...identities], catalogApps).apps
}

interface HydrationInput {
	activeView: AppView
	filteredApps: AppInfo[]
	morePreview: MorePreview
	primaryApps: AppInfo[]
	scenarioApps: AppInfo[]
}

export function selectHydrationApps({
	activeView,
	filteredApps,
	morePreview,
	primaryApps,
	scenarioApps,
}: HydrationInput): AppInfo[] {
	if (activeView === 'scenarios') return scenarioApps.concat(primaryApps)
	if (activeView === 'more')
		return [
			...morePreview.auxiliary,
			...morePreview.hidden,
			...morePreview.installersDocs,
		]
			.map(entry => entry.app)
			.concat(scenarioApps)
	if (!isCatalogView(activeView)) return []
	if (activeView === 'favorites') return filteredApps.concat(scenarioApps)
	return filteredApps
}

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CategoryList } from '../../../../src/widgets/catalog-content/ui/AppGrid/CategoryList'
import { createAppStore } from '../../../../src/app/store/appStore'
import { AppStoreProvider } from '../../../../src/app/store/storeContext'
import type { AppInfo, AppsClient } from '../../../../src/entities/app'
import type { CategoryDefinition } from '../../../../src/entities/category'

function emptyClient(): AppsClient {
	return {
		getApps: vi.fn().mockResolvedValue({ apps: [], hasCache: true }),
		refreshApps: vi.fn().mockResolvedValue({ apps: [], generation: 1 }),
		cancelScan: vi.fn().mockResolvedValue(undefined),
		launchApp: vi.fn().mockResolvedValue(undefined),
		closeApps: vi.fn().mockResolvedValue({
			closed: 0,
			notRunning: 0,
			unavailable: 0,
			failed: 0,
		}),
		getAppDetails: vi.fn().mockResolvedValue({
			fileSizeBytes: null,
			fileCreatedAt: null,
			fileModifiedAt: null,
			architecture: 'unknown',
			signature: 'unavailable',
			executableExists: null,
			installLocationExists: null,
		}),
		openAppFolder: vi.fn().mockResolvedValue(undefined),
		onScanProgress: vi.fn().mockResolvedValue(() => undefined),
	}
}

const rufus: AppInfo = {
	id: 'rufus',
	name: 'Rufus',
	path: 'F:\\Tools\\rufus.exe',
	category: 'drive:f',
	iconBase64: null,
	launchKind: 'executable',
	sourceKind: 'portable',
	platformKind: null,
	description: null,
	version: null,
	publisher: null,
	installLocation: 'F:\\Tools',
	canUninstall: false,
	scanFolder: 'F:\\',
}

const categories: CategoryDefinition[] = [
	{ id: 'utilities', label: 'Utilities', builtIn: true },
	{ id: 'drive:f', label: 'Disk F', builtIn: false },
	{ id: 'custom:work', label: 'Work', builtIn: false },
]

function renderList(apps: AppInfo[]) {
	render(
		<AppStoreProvider store={createAppStore(emptyClient(), localStorage)}>
			<CategoryList
				apps={apps}
				isLoading={false}
				hasQuery={false}
				activeView="all"
				searchScopeCounts={{
					all: 0,
					auxiliary: 0,
					hidden: 0,
					installersDocs: 0,
				}}
				onSelectView={vi.fn()}
				categoryOrder={['drive:f', 'custom:work', 'utilities']}
				categories={categories}
				collapsedCategories={[]}
				favoriteAppIds={[]}
				favoriteScenarios={{
					scenarios: [],
					apps: [],
					runningId: null,
					isScenarioRunning: false,
					onRun: vi.fn(),
					onToggleFavorite: vi.fn(),
				}}
				onBack={vi.fn()}
				onToggleCategory={vi.fn()}
				onToggleFavorite={vi.fn()}
				onMoveApp={vi.fn()}
				onLaunch={vi.fn().mockResolvedValue(undefined)}
				onInfo={vi.fn()}
				onOpenFolder={vi.fn().mockResolvedValue(undefined)}
				onManageInWindows={vi.fn()}
				onHide={vi.fn()}
				onRestore={vi.fn()}
				onPromoteAuxiliary={vi.fn()}
				onDemoteAuxiliary={vi.fn()}
				onRenameCategory={vi.fn().mockReturnValue({ ok: true })}
				onDeleteCategory={vi.fn().mockReturnValue({ ok: true })}
			/>
		</AppStoreProvider>,
	)
}

describe('CategoryList', () => {
	// A drive category with nothing in it means the stick is out: a heading over nothing would
	// only advertise apps that cannot launch. A user category stays so apps can be moved into it.
	it('hides an empty drive category but keeps an empty user category', () => {
		renderList([])

		expect(
			screen.queryByRole('group', { name: 'Disk F category controls' }),
		).not.toBeInTheDocument()
		expect(
			screen.getByRole('group', { name: 'Work category controls' }),
		).toBeInTheDocument()
	})

	it('shows the drive category as soon as the scan finds the stick again', () => {
		renderList([rufus])

		expect(
			screen.getByRole('group', { name: 'Disk F category controls' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: /^Launch Rufus/ }),
		).toBeInTheDocument()
	})
})

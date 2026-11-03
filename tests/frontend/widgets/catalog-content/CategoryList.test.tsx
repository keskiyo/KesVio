import {
	render,
	screen,
	waitForElementToBeRemoved,
	within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

function renderList(apps: AppInfo[], activeView: 'all' | 'favorites' = 'all') {
	const onLaunch = vi.fn().mockResolvedValue(undefined)
	render(
		<AppStoreProvider store={createAppStore(emptyClient(), localStorage)}>
			<CategoryList
				apps={apps}
				installedApps={[]}
				isLoading={false}
				hasQuery={false}
				activeView={activeView}
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
				onLaunch={onLaunch}
				onInfo={vi.fn()}
				onOpenFolder={vi.fn().mockResolvedValue(undefined)}
				onManageInWindows={vi.fn()}
				fileActions={{ openFolder: vi.fn(), copyPath: vi.fn() }}
				onHide={vi.fn()}
				onRestore={vi.fn()}
				onRestoreAll={vi.fn()}
				onPromoteAuxiliary={vi.fn()}
				onDemoteAuxiliary={vi.fn()}
				onRenameCategory={vi.fn().mockReturnValue({ ok: true })}
				onDeleteCategory={vi.fn().mockReturnValue({ ok: true })}
			/>
		</AppStoreProvider>,
	)
	return onLaunch
}

describe('CategoryList', () => {
	it('closes only the card menu on the first Escape inside a publisher dialog', async () => {
		const user = userEvent.setup()
		renderList([
			{ ...rufus, id: 'one', name: 'One', publisher: 'Vendor' },
			{
				...rufus,
				id: 'two',
				name: 'Two',
				path: 'F:\\two.exe',
				publisher: 'Vendor',
			},
		])
		await user.click(screen.getByRole('button', { name: /Vendor.*2 apps/ }))
		const dialog = screen.getByRole('dialog', { name: 'Vendor' })
		const manage = within(dialog).getByRole('button', {
			name: 'Manage One',
		})
		await user.click(manage)
		await user.keyboard('{Escape}')
		expect(screen.queryByRole('menu')).not.toBeInTheDocument()
		expect(dialog.parentElement).not.toHaveClass('is-closing')
		expect(manage).toHaveFocus()
		await user.keyboard('{Escape}')
		await waitForElementToBeRemoved(dialog)
	})
	it('shows the disconnected state once on an offline drive category without enabling its apps', () => {
		renderList([
			{
				...rufus,
				targetAvailability: 'target.unverifiable.unmounted_volume',
			},
		])
		expect(
			within(
				screen.getByRole('group', { name: 'Disk F category controls' }),
			).getByText('Drive not connected'),
		).toBeVisible()
		expect(screen.getAllByText('Drive not connected')).toHaveLength(1)
		expect(
			screen.getByRole('button', { name: /Rufus: drive not connected/i }),
		).toBeDisabled()
	})

	it('does not label the whole drive disconnected if it contains an available app', () => {
		renderList([
			{
				...rufus,
				targetAvailability: 'target.unverifiable.unmounted_volume',
			},
			{ ...rufus, id: 'online', name: 'Online', path: 'F:\\online.exe' },
		])
		expect(
			screen.getByRole('button', { name: 'Collapse Disk F' }),
		).toBeInTheDocument()
		expect(screen.getByText('Drive not connected')).toBeVisible()
	})

	it('keeps grouped offline apps disabled without repeating the drive status in the dialog', async () => {
		const user = userEvent.setup()
		renderList([
			{
				...rufus,
				id: 'one',
				name: 'One',
				publisher: 'Vendor',
				targetAvailability: 'target.unverifiable.unmounted_volume',
			},
			{
				...rufus,
				id: 'two',
				name: 'Two',
				path: 'F:\\two.exe',
				publisher: 'Vendor',
				targetAvailability: 'target.unverifiable.unmounted_volume',
			},
		])
		await user.click(screen.getByRole('button', { name: 'Vendor, 2 apps' }))
		const dialog = screen.getByRole('dialog', { name: 'Vendor' })
		expect(
			within(dialog).queryByText('Drive not connected'),
		).not.toBeInTheDocument()
		expect(
			within(dialog).getByRole('button', {
				name: /One: drive not connected/i,
			}),
		).toBeDisabled()
		expect(
			within(dialog).getByRole('button', {
				name: /Two: drive not connected/i,
			}),
		).toBeDisabled()
	})
	it('groups apps by publisher in the same category and opens their original cards', async () => {
		const user = userEvent.setup()
		const onLaunch = renderList([
			{
				...rufus,
				id: 'battle',
				name: 'Battle.net',
				publisher: 'Blizzard Entertainment',
			},
			{
				...rufus,
				id: 'hearth',
				name: 'Hearthstone',
				path: 'F:\\hearth.exe',
				publisher: ' blizzard entertainment ',
			},
			{ ...rufus, id: 'unknown', name: 'Other', path: 'F:\\other.exe' },
		])
		const group = screen.getByRole('button', {
			name: /Battle\.net.*2 apps/i,
		})
		expect(screen.getByText('3 apps')).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: /^Launch Other/ }),
		).toBeInTheDocument()
		await user.click(group)
		expect(
			screen.getByRole('dialog', { name: 'Battle.net' }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: /^Launch Battle.net/ }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: /^Launch Hearthstone/ }),
		).toBeInTheDocument()
		await user.click(
			screen.getByRole('button', { name: /^Launch Hearthstone/ }),
		)
		expect(onLaunch).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'hearth' }),
		)
		await user.keyboard('{Escape}')
		await waitForElementToBeRemoved(() => screen.queryByRole('dialog'))
		expect(group).toHaveFocus()
	})

	it('uses the shared product name for a suite with a matching main app', () => {
		renderList([
			{
				...rufus,
				id: 'libre',
				name: 'LibreOffice',
				productName: 'LibreOffice',
				publisher: 'The Document Foundation',
			},
			{
				...rufus,
				id: 'calc',
				name: 'LibreOffice Calc',
				path: 'C:\\calc.exe',
				productName: 'LibreOffice',
				publisher: 'The Document Foundation',
			},
		])
		expect(
			screen.getByRole('button', { name: 'LibreOffice, 2 apps' }),
		).toBeInTheDocument()
	})

	it('keeps the publisher label when only part of a group shares a product', () => {
		renderList([
			{
				...rufus,
				id: 'suite',
				name: 'Suite',
				productName: 'Suite',
				publisher: 'Vendor',
			},
			{
				...rufus,
				id: 'suite-tool',
				name: 'Suite Tool',
				path: 'F:\\suite-tool.exe',
				productName: 'Suite',
				publisher: 'Vendor',
			},
			{
				...rufus,
				id: 'other',
				name: 'Other',
				path: 'F:\\other.exe',
				productName: 'Other',
				publisher: 'Vendor',
			},
		])
		expect(
			screen.getByRole('button', { name: 'Vendor, 3 apps' }),
		).toBeInTheDocument()
	})

	it('does not group entries outside All Apps', () => {
		const first = { ...rufus, id: 'one', name: 'One', publisher: 'Vendor' }
		const second = {
			...rufus,
			id: 'two',
			name: 'Two',
			path: 'F:\\two.exe',
			publisher: 'Vendor',
		}
		renderList([first, second], 'favorites')
		expect(
			screen.queryByRole('button', { name: /Vendor, 2 apps/ }),
		).not.toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: /^Launch One/ }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: /^Launch Two/ }),
		).toBeInTheDocument()
	})

	it('shows file names for identically named variants in a publisher group', async () => {
		const user = userEvent.setup()
		renderList([
			{
				...rufus,
				id: '32',
				name: 'Tool',
				path: 'F:\\Tool_x86.exe',
				publisher: 'Vendor',
			},
			{
				...rufus,
				id: '64',
				name: 'Tool',
				path: 'F:\\Tool_x64.exe',
				publisher: 'Vendor',
			},
		])
		await user.click(screen.getByRole('button', { name: 'Vendor, 2 apps' }))
		expect(screen.getByText('Tool_x86.exe')).toBeInTheDocument()
		expect(screen.getByText('Tool_x64.exe')).toBeInTheDocument()
	})

	it('closes a group when clicking the backdrop but not the dialog', async () => {
		const user = userEvent.setup()
		renderList([
			{ ...rufus, id: 'one', name: 'One', publisher: 'Vendor' },
			{
				...rufus,
				id: 'two',
				name: 'Two',
				path: 'F:\\two.exe',
				publisher: 'Vendor',
			},
		])
		const trigger = screen.getByRole('button', { name: 'Vendor, 2 apps' })
		await user.click(trigger)
		const dialog = screen.getByRole('dialog', { name: 'Vendor' })
		await user.click(dialog)
		expect(dialog).toBeInTheDocument()
		await user.click(dialog.parentElement!)
		expect(dialog).toBeInTheDocument()
		await waitForElementToBeRemoved(() => screen.queryByRole('dialog'))
		expect(trigger).toHaveFocus()
	})

	it('keeps single or unknown publishers separate within each category', () => {
		renderList([
			{ ...rufus, id: 'one', name: 'One', publisher: 'Vendor' },
			{
				...rufus,
				id: 'two',
				name: 'Two',
				path: 'C:\\two.exe',
				category: 'utilities',
				publisher: 'Vendor',
			},
			{
				...rufus,
				id: 'three',
				name: 'Three',
				path: 'F:\\three.exe',
				publisher: ' ',
			},
			{
				...rufus,
				id: 'four',
				name: 'Four',
				path: 'F:\\four.exe',
				publisher: null,
			},
		])
		expect(
			screen.queryByRole('button', { name: /Vendor, 2 apps/ }),
		).not.toBeInTheDocument()
		for (const name of ['One', 'Two', 'Three', 'Four'])
			expect(
				screen.getByRole('button', { name: `Launch ${name}` }),
			).toBeInTheDocument()
	})
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

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InstallersDocsGrid } from '../../../../src/widgets/catalog-content/ui/InstallersDocsGrid/InstallersDocsGrid'
import type { AppInfo } from '../../../../src/entities/app'

vi.mock('../../../../src/features/launch-app/model/useIsLaunching', () => ({
	useIsLaunching: () => false,
}))

function entry(id: string, extra: Partial<AppInfo>): AppInfo {
	return {
		id,
		name: id,
		path: `E:\\Shared\\Programs\\Downloads\\${id}.exe`,
		iconBase64: null,
		artifactKind: 'installer',
		category: 'installers_docs',
		launchKind: 'executable',
		sourceKind: 'portable',
		platformKind: null,
		description: null,
		version: null,
		publisher: null,
		installLocation: null,
		canUninstall: false,
		...extra,
	}
}

function view(apps: AppInfo[], installedApps: AppInfo[] = []) {
	const props = {
		apps,
		installedApps,
		hasQuery: false,
		categoryOrder: ['installers_docs'],
		categories: [
			{
				id: 'installers_docs',
				label: 'Installers & Docs',
				builtIn: true,
			},
		],
		onBack: vi.fn(),
		onLaunch: vi.fn().mockResolvedValue(undefined),
		onMoveApp: vi.fn(),
		onInfo: vi.fn(),
		onOpenFolder: vi.fn().mockResolvedValue(undefined),
		onManageInWindows: vi.fn(),
		onHide: vi.fn(),
		onRestore: vi.fn(),
		onDemoteAuxiliary: vi.fn(),
	}
	render(<InstallersDocsGrid {...props} />)
	return props
}

describe('Installers & Docs rows', () => {
	// The full path in a monospace line was the loudest part of every row and still cut off
	// the folder that mattered; the row names the folder and keeps the path in its tooltip.
	it('names the folder instead of printing the full path', () => {
		view([entry('7-Zip Setup', { publisher: 'Igor Pavlov' })])

		const folder = screen.getByTitle(
			'E:\\Shared\\Programs\\Downloads\\7-Zip Setup.exe',
		)
		expect(folder).toHaveTextContent('Downloads')
		expect(screen.getByRole('article')).not.toHaveTextContent('E:\\Shared')
	})

	it('opens the folder from a visible action on the row', async () => {
		const props = view([entry('Editor Setup', {})])

		await userEvent.click(
			screen.getByRole('button', {
				name: 'Open the folder of Editor Setup',
			}),
		)

		expect(props.onOpenFolder).toHaveBeenCalledWith(props.apps[0])
	})

	// An installer for a version older than the one installed is safe to delete, which is the
	// question someone cleaning Downloads is asking.
	it('marks an installer that is older than the installed program', () => {
		view(
			[
				entry('7-Zip', { version: '23.01', publisher: 'Igor Pavlov' }),
				entry('Fresh Tool', { version: '2.0', publisher: 'Maker' }),
			],
			[
				entry('7-Zip installed', {
					name: '7-Zip',
					artifactKind: 'application',
					version: '25.01',
					publisher: 'Igor Pavlov',
				}),
				entry('Fresh installed', {
					name: 'Fresh Tool',
					artifactKind: 'application',
					version: '1.0',
					publisher: 'Maker',
				}),
			],
		)

		const [sevenZip, fresh] = screen.getAllByRole('article')
		expect(sevenZip).toHaveTextContent('Installed 25.01 is newer')
		expect(fresh).not.toHaveTextContent('is newer')
	})

	it('does not compare an installer whose publisher is unknown', () => {
		view(
			[entry('7-Zip', { version: '23.01' })],
			[
				entry('7-Zip installed', {
					name: '7-Zip',
					artifactKind: 'application',
					version: '25.01',
					publisher: 'Igor Pavlov',
				}),
			],
		)

		expect(screen.getByRole('article')).not.toHaveTextContent('is newer')
	})

	it('folds older copies of one installer behind a toggle', async () => {
		view([
			entry('Shark 1', {
				name: 'Attack Shark Software',
				publisher: 'Shark',
				version: '1.0',
			}),
			entry('Shark 2', {
				name: 'Attack Shark Software',
				publisher: 'Shark',
				version: '1.2',
			}),
		])

		expect(screen.getAllByRole('article')).toHaveLength(1)
		await userEvent.click(
			screen.getByRole('button', {
				name: 'Show 1 older version of Attack Shark Software',
			}),
		)
		expect(screen.getAllByRole('article')).toHaveLength(2)
	})
})

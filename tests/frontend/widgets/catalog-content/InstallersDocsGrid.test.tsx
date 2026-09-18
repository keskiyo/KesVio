import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InstallersDocsGrid } from '../../../../src/widgets/catalog-content/ui/InstallersDocsGrid/InstallersDocsGrid'
import type { AppInfo } from '../../../../src/entities/app'

vi.mock('../../../../src/widgets/catalog-content/ui/AppRow/AppRow', () => ({
	AppRow: ({ app }: { app: AppInfo }) => <article>{app.name}</article>,
}))

function app(id: string, artifactKind: 'installer' | 'documentation'): AppInfo {
	return {
		id,
		name: id,
		path: `C:\\${id}.exe`,
		iconBase64: null,
		artifactKind,
		category: 'installers_docs',
		launchKind: 'executable',
		sourceKind: 'portable',
		platformKind: null,
		description: null,
		version: null,
		publisher: null,
		installLocation: null,
		canUninstall: false,
	}
}

const callbacks = {
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

describe('InstallersDocsGrid', () => {
	it('partitions artifacts into counted groups', () => {
		render(
			<InstallersDocsGrid
				{...callbacks}
				apps={[
					app('Visual Studio Setup', 'installer'),
					app('Application Verifier Help', 'documentation'),
				]}
				hasQuery={false}
			/>,
		)

		expect(
			screen.getByRole('heading', { name: 'Installers 1' }),
		).toBeVisible()
		expect(
			screen.getByRole('heading', { name: 'Documentation 1' }),
		).toBeVisible()
		expect(
			screen.getByRole('region', { name: 'Installers & Docs' }),
		).toHaveTextContent(
			'Setup packages and documentation found while scanning.',
		)
		expect(screen.getByText('Visual Studio Setup')).toBeVisible()
		expect(screen.getByText('Application Verifier Help')).toBeVisible()
	})

	it('omits an empty group and explains an empty filtered result', () => {
		const { rerender } = render(
			<InstallersDocsGrid
				{...callbacks}
				apps={[app('Very long installer product name', 'installer')]}
				hasQuery={false}
			/>,
		)
		// Anchored: the page title is "Installers & Docs" and must not be mistaken for the group.
		expect(
			screen.queryByRole('heading', { name: /^Documentation/ }),
		).not.toBeInTheDocument()

		rerender(
			<InstallersDocsGrid {...callbacks} apps={[]} hasQuery={true} />,
		)
		expect(screen.getByText('No matching installers or docs')).toBeVisible()
	})

	it('keeps the title and the way back while the view is empty', async () => {
		const onBack = vi.fn()
		render(
			<InstallersDocsGrid
				{...callbacks}
				onBack={onBack}
				apps={[]}
				hasQuery={false}
			/>,
		)

		// Entering a view you cannot leave is worse than an empty one, so the header outlives
		// the list it titles.
		expect(
			screen.getByRole('heading', {
				level: 1,
				name: 'Installers & Docs',
			}),
		).toBeVisible()
		expect(
			screen.getByRole('region', { name: 'Installers & Docs' }),
		).toHaveTextContent('0 items')
		const backButtons = screen.getAllByRole('button', {
			name: 'Back to More',
		})
		expect(backButtons).toHaveLength(2)
		await userEvent.click(backButtons[1]!)
		expect(onBack).toHaveBeenCalledOnce()
	})
})

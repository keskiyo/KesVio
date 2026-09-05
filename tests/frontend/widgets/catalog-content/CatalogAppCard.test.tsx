import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CatalogAppCard } from '../../../../src/widgets/catalog-content/ui/CatalogAppCard/CatalogAppCard'
import type { AppInfo } from '../../../../src/entities/app'
import type {
	AppCategory,
	CategoryDefinition,
} from '../../../../src/entities/category'

vi.mock('../../../../src/features/launch-app/model/useIsLaunching', () => ({
	useIsLaunching: () => false,
}))

const development: CategoryDefinition = {
	id: 'development',
	label: 'Development',
	builtIn: true,
}

const app: AppInfo = {
	id: 'claude',
	name: 'Claude',
	path: 'C:\\Claude\\claude.exe',
	iconBase64: null,
	category: 'development',
	launchKind: 'executable',
	sourceKind: 'registry',
	platformKind: null,
	description: null,
	version: null,
	publisher: null,
	installLocation: null,
	canUninstall: false,
}

function renderCard(entry: AppInfo) {
	render(
		<CatalogAppCard
			app={entry}
			isFavorite={false}
			categories={[development]}
			categoryOrder={['development'] as AppCategory[]}
			onToggleFavorite={vi.fn()}
			onLaunch={vi.fn().mockResolvedValue(undefined)}
			onMove={vi.fn()}
			onInfo={vi.fn()}
			onManageInWindows={vi.fn()}
			onHide={vi.fn()}
			onRestore={vi.fn()}
			onDemote={vi.fn()}
		/>,
	)
}

describe('CatalogAppCard', () => {
	it('renders non-draggable card actions', () => {
		render(
			<CatalogAppCard
				app={app}
				isFavorite={false}
				categories={[development]}
				categoryOrder={['development'] as AppCategory[]}
				onToggleFavorite={vi.fn()}
				onLaunch={vi.fn().mockResolvedValue(undefined)}
				onMove={vi.fn()}
				onInfo={vi.fn()}
				onManageInWindows={vi.fn()}
				onHide={vi.fn()}
				onRestore={vi.fn()}
				onDemote={vi.fn()}
			/>,
		)

		expect(
			screen.getByRole('button', { name: 'Manage Claude' }),
		).toContainHTML('lucide-ellipsis-vertical')
		const favorite = screen.getByRole('button', {
			name: 'Add Claude to favorites',
		})
		expect(favorite).toHaveAttribute('aria-pressed', 'false')
		expect(favorite).not.toHaveClass('border')
	})

	it('keeps the selected favorite as a star without a colored button surface', () => {
		render(
			<CatalogAppCard
				app={app}
				isFavorite
				categories={[development]}
				categoryOrder={['development'] as AppCategory[]}
				onToggleFavorite={vi.fn()}
				onLaunch={vi.fn().mockResolvedValue(undefined)}
				onMove={vi.fn()}
				onInfo={vi.fn()}
				onManageInWindows={vi.fn()}
				onHide={vi.fn()}
				onRestore={vi.fn()}
				onDemote={vi.fn()}
			/>,
		)

		const favorite = screen.getByRole('button', {
			name: 'Remove Claude from favorites',
		})
		expect(favorite).toHaveAttribute('aria-pressed', 'true')
		expect(favorite).not.toHaveClass('bg-yellow-300/20')
	})

	it.each([
		['steam', 'Steam', 'lucide-gamepad2', null, 'Launch Claude from Steam'],
		[
			'battle_net',
			'Battle.net',
			'lucide-gamepad2',
			null,
			'Launch Claude from Battle.net',
		],
		[
			'microsoft_store',
			'Microsoft Store',
			'lucide-shopping-bag',
			null,
			'Launch Claude from Microsoft Store',
		],
		['portable', 'Portable', null, 'M8 8V3h8v5', 'Launch Claude'],
	] as const)(
		'shows the %s platform badge',
		(platformKind, label, iconClass, pathStart, launchName) => {
			renderCard({ ...app, platformKind })

			const badge = screen.getByTitle(label)
			expect(badge).toHaveAttribute('data-platform', platformKind)
			const icon = badge.querySelector(
				`[data-platform-icon="${platformKind}"]`,
			)
			expect(icon).toBeInTheDocument()
			if (iconClass) {
				expect(icon).toHaveClass(iconClass)
			} else if (pathStart) {
				expect(
					icon?.querySelector('path')?.getAttribute('d'),
				).toContain(pathStart)
			}
			expect(
				screen.getByRole('button', { name: launchName }),
			).toBeInTheDocument()
		},
	)

	// "from Steam" names the storefront the launch goes through. "from Portable" names nothing a
	// user recognises, so the badge carries that signal alone and the accessible name stays plain.
	it('keeps the plain accessible name for a portable entry', () => {
		renderCard({ ...app, platformKind: 'portable' })

		expect(
			screen.queryByRole('button', {
				name: 'Launch Claude from Portable',
			}),
		).not.toBeInTheDocument()
		expect(screen.getByTitle('Portable')).toBeInTheDocument()
	})

	it('omits the platform badge for an ordinary Windows entry', () => {
		renderCard(app)

		expect(
			screen.getByRole('button', { name: 'Launch Claude' }),
		).toBeInTheDocument()
		for (const label of [
			'Steam',
			'Battle.net',
			'Microsoft Store',
			'Portable',
		]) {
			expect(screen.queryByTitle(label)).not.toBeInTheDocument()
		}
	})
})

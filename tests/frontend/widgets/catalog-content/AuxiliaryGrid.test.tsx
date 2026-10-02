import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AuxiliaryGrid } from '../../../../src/widgets/catalog-content/ui/AuxiliaryGrid/AuxiliaryGrid'
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

function tool(
	id: string,
	name: string,
	publisher: string,
	extra: Partial<AppInfo> = {},
): AppInfo {
	return {
		id,
		name,
		path: `C:\\Tools\\${id}.exe`,
		iconBase64: null,
		category: 'development',
		launchKind: 'executable',
		sourceKind: 'registry',
		platformKind: null,
		description: null,
		version: null,
		publisher,
		installLocation: null,
		canUninstall: false,
		...extra,
	}
}

function props(
	apps: AppInfo[] = [
		tool('zeta', 'Zeta', 'Anthropic PBC'),
		tool('alpha', 'Alpha', 'Devsense'),
	],
) {
	return {
		apps,
		hasQuery: false,
		favoriteAppIds: [],
		categories: [development],
		categoryOrder: ['development'] as AppCategory[],
		onBack: vi.fn(),
		onLaunch: vi.fn().mockResolvedValue(undefined),
		onMoveApp: vi.fn(),
		onInfo: vi.fn(),
		onManageInWindows: vi.fn(),
		onPromote: vi.fn(),
		onDemote: vi.fn(),
	}
}

const launchNames = () =>
	screen
		.getAllByRole('button', { name: /^Launch / })
		.map(button => button.getAttribute('aria-label'))

describe('AuxiliaryGrid', () => {
	it('renders tools in one ungrouped alphabetical sequence', () => {
		render(<AuxiliaryGrid {...props()} />)

		expect(launchNames()).toEqual(['Launch Alpha', 'Launch Zeta'])
		expect(
			screen.queryByRole('region', { name: 'Anthropic PBC' }),
		).not.toBeInTheDocument()
	})

	it('titles the view, counts its tools and returns to More', async () => {
		const view = props()
		render(<AuxiliaryGrid {...view} />)

		const region = screen.getByRole('region', { name: 'Auxiliary tools' })
		expect(region).toHaveTextContent('2 tools')
		expect(region).toHaveTextContent(
			'Helper executables discovered by KesVio.',
		)
		await userEvent.click(
			screen.getByRole('button', { name: 'Back to More' }),
		)
		expect(view.onBack).toHaveBeenCalled()
	})

	// The title used to sit at the left edge while the list was a narrow centered column, so the
	// two never lined up on a wide window; they now share one frame and the list fills it.
	it('keeps the title and a width-filling list in one frame', () => {
		render(<AuxiliaryGrid {...props()} />)

		const region = screen.getByRole('region', { name: 'Auxiliary tools' })
		const row = screen.getAllByRole('article')[0]
		expect(region).toHaveClass('max-w-[80rem]')
		expect(region).toContainElement(row ?? null)
		expect(row?.parentElement).toHaveClass(
			'grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))]',
		)
	})

	it('restores a tool to the catalog from a visible action on its row', async () => {
		const view = props()
		render(<AuxiliaryGrid {...view} />)

		await userEvent.click(
			screen.getByRole('button', { name: 'Restore Alpha to catalog' }),
		)

		expect(view.onPromote).toHaveBeenCalledWith('alpha')
	})

	// Seventy-odd helpers with no explanation read as noise; the row says why a program is here
	// and the chips narrow the list to one reason.
	it('labels each tool with its reason and filters by reason', async () => {
		render(
			<AuxiliaryGrid
				{...props([
					tool('uninstall', 'Uninstall Chat', 'Chat Inc', {
						visibilityReasons: ['maintenance_executable'],
					}),
					tool('bun', 'Bun', 'Oven', {
						visibilityReasons: ['console_application'],
					}),
					tool('deno', 'Deno', 'Deno Land', {
						visibilityReasons: ['console_application'],
					}),
				])}
			/>,
		)

		const rows = screen.getAllByRole('article')
		expect(rows[0]).toHaveTextContent('Console application')
		const filter = screen.getByRole('group', {
			name: 'Filter auxiliary tools by reason',
		})
		await userEvent.click(
			within(filter).getByRole('button', {
				name: /Maintenance executable/,
			}),
		)

		expect(launchNames()).toEqual(['Launch Uninstall Chat'])
		await userEvent.click(
			within(filter).getByRole('button', { name: /^All/ }),
		)
		expect(launchNames()).toHaveLength(3)
	})

	// On a narrow window the reason chips wrapped into six rows above the list; the same choice
	// is a single select there.
	it('offers the reason filter as a select for narrow windows', async () => {
		render(
			<AuxiliaryGrid
				{...props([
					tool('uninstall', 'Uninstall Chat', 'Chat Inc', {
						visibilityReasons: ['maintenance_executable'],
					}),
					tool('bun', 'Bun', 'Oven', {
						visibilityReasons: ['console_application'],
					}),
				])}
			/>,
		)

		await userEvent.selectOptions(
			screen.getByRole('combobox', { name: 'Reason' }),
			'maintenance_executable',
		)

		expect(launchNames()).toEqual(['Launch Uninstall Chat'])
	})

	it('folds older versions of one tool behind a toggle', async () => {
		render(
			<AuxiliaryGrid
				{...props([
					tool('bun-old', 'Bun', 'Oven', { version: '1.3.11' }),
					tool('bun-new', 'Bun', 'Oven', { version: '1.3.14' }),
				])}
			/>,
		)

		expect(screen.getAllByRole('article')).toHaveLength(1)
		expect(screen.getByRole('article')).toHaveTextContent('1.3.14')
		const toggle = screen.getByRole('button', {
			name: 'Show 1 older version of Bun',
		})
		await userEvent.click(toggle)

		expect(screen.getAllByRole('article')).toHaveLength(2)
		expect(
			screen.getByRole('button', { name: 'Hide 1 older version of Bun' }),
		).toHaveAttribute('aria-expanded', 'true')
	})

	it('keeps the way back when no tool matches the search', async () => {
		const view = props([])
		render(<AuxiliaryGrid {...view} hasQuery />)

		expect(screen.getByText('No matching auxiliary tools')).toBeVisible()
		await userEvent.click(
			screen.getByRole('button', { name: 'Back to More' }),
		)
		expect(view.onBack).toHaveBeenCalled()
	})

	it('explains an empty catalog of tools and offers the way back', async () => {
		const view = props([])
		render(<AuxiliaryGrid {...view} />)

		expect(
			screen.getByRole('heading', { name: 'No auxiliary tools found' }),
		).toBeVisible()
		const backButtons = screen.getAllByRole('button', {
			name: 'Back to More',
		})
		expect(backButtons).toHaveLength(2)
		await userEvent.click(backButtons[1]!)
		expect(view.onBack).toHaveBeenCalledOnce()
	})
})

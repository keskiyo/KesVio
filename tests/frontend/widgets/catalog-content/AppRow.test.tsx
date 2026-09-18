import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRow } from '../../../../src/widgets/catalog-content/ui/AppRow/AppRow'
import type { AppInfo } from '../../../../src/entities/app'
import type {
	AppCategory,
	CategoryDefinition,
} from '../../../../src/entities/category'

const draggable = vi.hoisted(() => ({
	setNodeRef: vi.fn(),
	setActivatorNodeRef: vi.fn(),
	onPointerDown: vi.fn(),
	options: [] as Array<{ disabled?: boolean }>,
}))

vi.mock('@dnd-kit/core', () => ({
	useDraggable: (options: { disabled?: boolean }) => ({
		...(draggable.options.push(options) && {}),
		attributes: {},
		listeners: { onPointerDown: draggable.onPointerDown },
		setNodeRef: draggable.setNodeRef,
		setActivatorNodeRef: draggable.setActivatorNodeRef,
		transform: null,
		isDragging: false,
	}),
}))

vi.mock('../../../../src/features/launch-app/model/useIsLaunching', () => ({
	useIsLaunching: () => false,
}))

const development: CategoryDefinition = {
	id: 'development',
	label: 'Development',
	builtIn: true,
}

const app: AppInfo = {
	id: 'claude-code',
	name: 'Claude Code',
	path: 'C:\\Tools\\claude.exe',
	iconBase64: null,
	category: 'development',
	launchKind: 'executable',
	sourceKind: 'registry',
	platformKind: null,
	description: null,
	version: 'v2.1.186.0',
	publisher: 'Anthropic PBC',
	installLocation: null,
	canUninstall: false,
}

function props(appOverride: AppInfo = app) {
	return {
		app: appOverride,
		categories: [development],
		categoryOrder: ['development'] as AppCategory[],
		isHidden: true,
		onLaunch: vi.fn().mockResolvedValue(undefined),
		onMove: vi.fn(),
		onInfo: vi.fn(),
		onManageInWindows: vi.fn(),
		onRestore: vi.fn(),
		onDemote: vi.fn(),
	}
}

beforeEach(() => {
	draggable.options.length = 0
	draggable.setNodeRef.mockReset()
	draggable.setActivatorNodeRef.mockReset()
	draggable.onPointerDown.mockReset()
})

describe('AppRow', () => {
	it('shows compact tool identity and accessible actions', () => {
		render(<AppRow {...props()} />)

		expect(
			screen.getByRole('button', { name: 'Launch Claude Code' }),
		).toHaveTextContent('Claude Code')
		expect(
			screen.getByText('Anthropic PBC · v2.1.186.0'),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'Manage Claude Code' }),
		).toHaveAttribute('aria-haspopup', 'menu')
	})

	it('omits empty metadata without leaving a separator', () => {
		render(
			<AppRow {...props({ ...app, publisher: null, version: null })} />,
		)

		expect(screen.queryByText('·')).not.toBeInTheDocument()
		expect(screen.queryByText('Unknown publisher')).not.toBeInTheDocument()
	})

	it('offers Restore for an auxiliary tool and Hide for a catalog artifact', async () => {
		const auxiliary = props()
		const { unmount } = render(<AppRow {...auxiliary} />)
		await userEvent.click(
			screen.getByRole('button', { name: 'Manage Claude Code' }),
		)
		await userEvent.click(
			screen.getByRole('menuitem', { name: 'Restore to catalog' }),
		)
		expect(auxiliary.onRestore).toHaveBeenCalledWith('claude-code')
		unmount()

		const onHide = vi.fn()
		const installer = {
			...props({
				...app,
				id: 'installer',
				name: 'Setup',
				artifactKind: 'installer' as const,
			}),
			isHidden: false,
			onHide,
		}
		render(<AppRow {...installer} />)
		await userEvent.click(
			screen.getByRole('button', { name: 'Manage Setup' }),
		)
		expect(
			screen.queryByRole('menuitem', { name: 'Restore to catalog' }),
		).not.toBeInTheDocument()
		await userEvent.click(
			screen.getByRole('menuitem', { name: 'Hide from catalog' }),
		)
		expect(onHide).toHaveBeenCalledWith('installer')
	})

	// Several downloads of one product carry the same name and version; only the file's own
	// location tells them apart, so an artifact row shows where it lives.
	it('shows where an installer lives and keeps an application row free of paths', () => {
		const { unmount } = render(<AppRow {...props()} />)
		expect(screen.queryByText(/C:\\Tools/)).not.toBeInTheDocument()
		unmount()

		render(
			<AppRow
				{...props({
					...app,
					id: 'setup',
					name: 'Visual Studio',
					artifactKind: 'installer',
					path: 'D:\\Downloads\\vs_Community.exe',
				})}
				isHidden={false}
			/>,
		)

		expect(
			screen.getByText('D:\\Downloads\\vs_Community.exe'),
		).toHaveAttribute('title', 'D:\\Downloads\\vs_Community.exe')
	})

	it('drags an auxiliary tool but never an installer, whose move would be a no-op', () => {
		const { unmount } = render(<AppRow {...props()} />)
		expect(draggable.options[draggable.options.length - 1]?.disabled).toBe(
			false,
		)
		unmount()

		render(
			<AppRow
				{...props({
					...app,
					id: 'setup',
					artifactKind: 'installer',
				})}
				isHidden={false}
			/>,
		)
		expect(draggable.options[draggable.options.length - 1]?.disabled).toBe(
			true,
		)
	})

	// Seventy tools with the same violet outline read as noise; the accent belongs to the row
	// the pointer or keyboard is on.
	it('keeps the row neutral until it is hovered, focused or has its menu open', () => {
		render(<AppRow {...props()} />)

		const row = screen
			.getByRole('button', { name: 'Launch Claude Code' })
			.closest('article')!
		expect(row.className).not.toMatch(/border-white|app-card-glass/)
		expect(row.className).toMatch(/\bborder-\(--border-neutral\)/)
		expect(row.className).toMatch(/\bhover:border-\(--accent\)/)
		expect(row.className).toMatch(
			/\bdata-\[menu-open\]:border-\(--accent\)/,
		)
		expect(row.className).not.toMatch(/translate/)
		expect(row.querySelector('.app-card-icon')!.className).not.toMatch(
			/ring-violet/,
		)
		expect(
			screen.getByRole('button', { name: 'Manage Claude Code' })
				.className,
		).toMatch(/\bopacity-60\b/)
	})

	// An installer is a file, not an installed program: Windows cannot uninstall it, but the
	// folder it sits in is the place a user goes to delete or run it by hand.
	it('opens the folder of an artifact instead of offering Uninstall', async () => {
		const onOpenFolder = vi.fn().mockResolvedValue(undefined)
		const installer = {
			...props({
				...app,
				id: 'setup',
				name: 'Setup',
				artifactKind: 'installer' as const,
				canUninstall: true,
			}),
			isHidden: false,
			onOpenFolder,
		}
		render(<AppRow {...installer} />)

		await userEvent.click(
			screen.getByRole('button', { name: 'Manage Setup' }),
		)
		expect(
			screen.queryByRole('menuitem', { name: /Uninstall/ }),
		).not.toBeInTheDocument()
		await userEvent.click(
			screen.getByRole('menuitem', { name: 'Open folder' }),
		)

		expect(onOpenFolder).toHaveBeenCalledWith(installer.app)
		expect(screen.queryByRole('menu')).not.toBeInTheDocument()
	})

	it('keeps Uninstall for an installed program and never shows Open folder there', async () => {
		render(
			<AppRow
				{...props({ ...app, canUninstall: true })}
				isHidden={false}
				onOpenFolder={vi.fn()}
			/>,
		)

		await userEvent.click(
			screen.getByRole('button', { name: 'Manage Claude Code' }),
		)
		expect(
			screen.getByRole('menuitem', { name: 'Uninstall' }),
		).toBeInTheDocument()
		expect(
			screen.queryByRole('menuitem', { name: 'Open folder' }),
		).not.toBeInTheDocument()
	})

	it('launches the selected tool', async () => {
		const rowProps = props()
		render(<AppRow {...rowProps} />)

		await userEvent.click(
			screen.getByRole('button', { name: 'Launch Claude Code' }),
		)

		expect(rowProps.onLaunch).toHaveBeenCalledOnce()
		expect(rowProps.onLaunch).toHaveBeenCalledWith(app)
	})
})

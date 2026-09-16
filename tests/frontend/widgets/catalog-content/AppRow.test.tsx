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
}))

vi.mock('@dnd-kit/core', () => ({
	useDraggable: () => ({
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

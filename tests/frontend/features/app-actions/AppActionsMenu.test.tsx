import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import '../../../../src/app/styles/index.css'
import { AppActionsMenu } from '../../../../src/features/app-actions/ui/AppActionsMenu/AppActionsMenu'
import type { AppInfo } from '../../../../src/entities/app'
import type { CategoryDefinition } from '../../../../src/entities/category'
import type { AppFileActions } from '../../../../src/features/app-actions'

const visualStudioCode: AppInfo = {
	id: 'code',
	name: 'Visual Studio Code',
	path: 'C:\\Code.exe',
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

function fileActions() {
	return {
		openFolder: vi.fn().mockResolvedValue(undefined),
		copyPath: vi.fn().mockResolvedValue(undefined),
		launchElevated: vi.fn().mockResolvedValue(undefined),
	}
}

function renderWithFileActions(
	app: AppInfo,
	extra: {
		isHidden?: boolean
		actions?: AppFileActions
	} = {},
) {
	const actions = extra.actions ?? fileActions()
	const onClose = vi.fn()
	const anchorRef = createRef<HTMLButtonElement>()
	render(
		<>
			<button ref={anchorRef} type="button" aria-label="anchor" />
			<AppActionsMenu
				app={app}
				categories={threeCategories}
				categoryOrder={threeCategories.map(category => category.id)}
				onClose={onClose}
				onMove={vi.fn()}
				onInfo={vi.fn()}
				onManageInWindows={vi.fn()}
				onHide={vi.fn()}
				onRestore={vi.fn()}
				onDemote={vi.fn()}
				fileActions={actions}
				isHidden={extra.isHidden}
				anchorRef={anchorRef}
			/>
		</>,
	)
	return { actions, onClose }
}

function rect(left: number, top: number, width: number, height: number) {
	return {
		x: left,
		y: top,
		width,
		height,
		top,
		right: left + width,
		bottom: top + height,
		left,
		toJSON: () => ({}),
	} as DOMRect
}

const withArtifacts: CategoryDefinition[] = [
	{ id: 'games', label: 'Games', builtIn: true },
	{ id: 'installers_docs', label: 'Installers & Docs', builtIn: true },
]

const threeCategories: CategoryDefinition[] = [
	{ id: 'games', label: 'Games', builtIn: true },
	{ id: 'development', label: 'Development', builtIn: true },
	{ id: 'browsers', label: 'Browsers', builtIn: true },
]

function renderMovableMenu(
	anchorRef = createRef<HTMLButtonElement>(),
	categories = threeCategories,
	placement: { isUserPromoted?: boolean; app?: AppInfo } = {},
) {
	const onClose = vi.fn()
	const onMove = vi.fn()
	render(
		<>
			<button
				ref={anchorRef}
				type="button"
				aria-label="Actions menu anchor"
			/>
			<AppActionsMenu
				app={visualStudioCode}
				categories={categories}
				categoryOrder={categories.map(category => category.id)}
				onClose={onClose}
				onMove={onMove}
				onInfo={vi.fn()}
				onManageInWindows={vi.fn()}
				fileActions={fileActions()}
				onHide={vi.fn()}
				onRestore={vi.fn()}
				onDemote={vi.fn()}
				anchorRef={anchorRef}
				{...placement}
			/>
		</>,
	)
	return { onClose, onMove }
}

// KesVio no longer removes software. The menu keeps the entry point a reader looks for and hands
// it to Windows, so `canUninstall` still means "Windows has a registered uninstaller for this" and
// nothing in the menu can start a removal.
describe('AppActionsMenu removal handover', () => {
	function renderWithUninstaller(canUninstall: boolean) {
		const onManageInWindows = vi.fn().mockResolvedValue(undefined)
		const anchor = createRef<HTMLButtonElement>()
		render(
			<>
				<button ref={anchor} type="button" aria-label="anchor" />
				<AppActionsMenu
					app={{ ...visualStudioCode, canUninstall }}
					categories={threeCategories}
					categoryOrder={threeCategories.map(category => category.id)}
					onClose={vi.fn()}
					onMove={vi.fn()}
					onInfo={vi.fn()}
					onManageInWindows={onManageInWindows}
					fileActions={fileActions()}
					onHide={vi.fn()}
					onRestore={vi.fn()}
					onDemote={vi.fn()}
					anchorRef={anchor}
				/>
			</>,
		)
		return onManageInWindows
	}

	it('hands a registered product to Windows instead of removing it', async () => {
		const onManageInWindows = renderWithUninstaller(true)

		await userEvent.click(
			screen.getByRole('menuitem', { name: 'Uninstall' }),
		)

		expect(onManageInWindows).toHaveBeenCalledOnce()
	})

	it('disables the handover when Windows has no uninstaller for the entry', () => {
		renderWithUninstaller(false)

		expect(
			screen.getByRole('menuitem', { name: 'Uninstall unavailable' }),
		).toBeDisabled()
		expect(
			screen.queryByRole('menuitem', { name: 'Uninstall' }),
		).not.toBeInTheDocument()
	})
})

describe('AppActionsMenu artifacts', () => {
	it('does not offer category moves or favorites for an installer artifact', () => {
		const app: AppInfo = {
			id: 'setup',
			name: 'Editor Setup',
			path: String.raw`C:\Downloads\setup.exe`,
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
		}
		render(
			<AppActionsMenu
				app={app}
				categories={[]}
				categoryOrder={[]}
				onClose={vi.fn()}
				onMove={vi.fn()}
				onInfo={vi.fn()}
				onManageInWindows={vi.fn()}
				fileActions={fileActions()}
				onHide={vi.fn()}
				onRestore={vi.fn()}
				onDemote={vi.fn()}
				anchorRef={createRef<HTMLButtonElement>()}
			/>,
		)

		expect(
			screen.queryByRole('menuitem', { name: 'Move to category' }),
		).not.toBeInTheDocument()
		expect(screen.getByRole('menuitem', { name: 'App info' })).toBeVisible()
	})
})

describe('AppActionsMenu category cascade', () => {
	it('uses compact sizing below the small-screen breakpoint', () => {
		renderMovableMenu()
		const menu = screen.getByRole('menu', {
			name: 'Visual Studio Code actions',
		})
		const info = screen.getByRole('menuitem', { name: 'App info' })

		expect(menu).toHaveClass('w-52', 'p-1.5', 'sm:w-56', 'sm:p-2')
		expect(info).toHaveClass(
			'py-2',
			'text-[13px]',
			'sm:py-2.5',
			'sm:text-sm',
		)
	})

	it('repositions when its rendered height changes', () => {
		let resize: ResizeObserverCallback | undefined
		class TestResizeObserver {
			constructor(callback: ResizeObserverCallback) {
				resize = callback
			}
			observe() {}
			disconnect() {}
			unobserve() {}
		}
		vi.stubGlobal('ResizeObserver', TestResizeObserver)
		const viewport = Object.getOwnPropertyDescriptor(window, 'innerHeight')
		let menuHeight = 240
		const bounds = vi
			.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
			.mockImplementation(function (this: HTMLElement) {
				if (this.getAttribute('aria-label') === 'Actions menu anchor')
					return rect(120, 40, 32, 32)
				if (
					this.getAttribute('aria-label') ===
					'Visual Studio Code actions'
				)
					return rect(120, 76, 208, menuHeight)
				return rect(0, 0, 0, 0)
			})
		Object.defineProperty(window, 'innerHeight', {
			configurable: true,
			value: 360,
		})

		try {
			renderMovableMenu()
			const menu = screen.getByRole('menu', {
				name: 'Visual Studio Code actions',
			})
			expect(menu).toHaveStyle({ top: '76px' })
			expect(resize).toBeDefined()

			menuHeight = 300
			act(() => resize?.([], {} as ResizeObserver))

			expect(menu).toHaveStyle({ top: '48px' })
		} finally {
			bounds.mockRestore()
			if (viewport) Object.defineProperty(window, 'innerHeight', viewport)
			vi.unstubAllGlobals()
		}
	})

	it('explains drive grouping and does not offer an ignored category move', () => {
		renderMovableMenu(undefined, undefined, {
			app: { ...visualStudioCode, scanFolder: 'F:\\' },
		})
		expect(
			screen.queryByRole('menuitem', { name: 'Move to category' }),
		).not.toBeInTheDocument()
		expect(
			screen.getByText(
				'Grouped by scan drive. Category changes are unavailable.',
			),
		).toBeVisible()
		expect(
			screen.getByRole('menuitem', { name: 'Hide from catalog' }),
		).toBeEnabled()
	})
	it('uses a right arrow and separator before the remaining actions', () => {
		renderMovableMenu()

		const move = screen.getByRole('menuitem', {
			name: 'Move to category',
		})
		expect(move.querySelector('svg')).toHaveClass('lucide-arrow-right')
		expect(move.nextElementSibling).toHaveAttribute('role', 'separator')
	})

	it('renders the move arrow after its row label', () => {
		renderMovableMenu()

		const move = screen.getByRole('menuitem', {
			name: 'Move to category',
		})
		const arrow = move.querySelector<SVGElement>('.lucide-arrow-right')
		expect(arrow).toBeInTheDocument()
		const label = within(move).getByText('Move to category', {
			selector: 'span',
		})
		expect(label.compareDocumentPosition(arrow!)).toBe(
			Node.DOCUMENT_POSITION_FOLLOWING,
		)
	})

	it('names the demotion in full for assistive technology while showing a label that fits one line', () => {
		renderMovableMenu(createRef<HTMLButtonElement>(), threeCategories, {
			isUserPromoted: true,
		})

		const demote = screen.getByRole('menuitem', {
			name: 'Move back to Auxiliary tools',
		})
		const visible = within(demote).getByText('Move back', {
			selector: '[aria-hidden="true"]',
		})
		expect(visible).toBeInTheDocument()
		expect(demote.querySelector('svg')).toHaveClass('lucide-wrench')
	})

	it('shows the Move back destination in a visual tooltip', () => {
		renderMovableMenu(createRef<HTMLButtonElement>(), threeCategories, {
			isUserPromoted: true,
		})

		const demote = screen.getByRole('menuitem', {
			name: 'Move back to Auxiliary tools',
		})
		const tooltip = demote.querySelector('[data-destination-tooltip]')
		expect(tooltip).toHaveTextContent('Moves to Auxiliary tools')
		expect(tooltip).toHaveAttribute('aria-hidden', 'true')
		expect(tooltip?.className).toContain('group-hover:opacity-100')
		expect(tooltip?.className).toContain('group-focus-visible:opacity-100')
		expect(tooltip?.className).toContain('motion-reduce:transition-none')
		expect(tooltip?.className).not.toContain('truncate')
		expect(demote.querySelector('[data-destination-hint]')).toBeNull()
	})

	// A third floating panel had nowhere to go in a narrow window and was clamped over the
	// category list; the branch now expands inside that list instead.
	it('expands installers and docs inside the category list instead of filing immediately', async () => {
		const user = userEvent.setup()
		const { onMove, onClose } = renderMovableMenu(
			createRef<HTMLButtonElement>(),
			withArtifacts,
		)

		await user.click(
			screen.getByRole('menuitem', { name: 'Move to category' }),
		)
		const categories = screen.getByRole('menu', {
			name: 'Move Visual Studio Code to category',
		})
		const branch = screen.getByRole('menuitem', {
			name: 'Installers & Docs',
		})
		expect(branch).toHaveAttribute('aria-haspopup', 'menu')
		expect(branch).toHaveAttribute('aria-expanded', 'false')
		expect(
			screen.queryByRole('menuitem', { name: 'Installers' }),
		).not.toBeInTheDocument()

		await user.click(branch)

		expect(onMove).not.toHaveBeenCalled()
		expect(branch).toHaveAttribute('aria-expanded', 'true')
		expect(screen.getAllByRole('menu')).toHaveLength(2)
		const group = within(categories).getByRole('group', {
			name: 'Installers & Docs',
		})
		expect(
			within(group).getByRole('menuitem', { name: 'Installers' }),
		).toBeInTheDocument()
		const items = within(categories).getAllByRole('menuitem')
		expect(items.indexOf(branch)).toBe(
			items.indexOf(
				within(group).getByRole('menuitem', { name: 'Installers' }),
			) - 1,
		)

		await user.click(within(group).getByRole('menuitem', { name: 'Docs' }))

		expect(onMove).toHaveBeenCalledWith(
			visualStudioCode.id,
			'installers_docs',
			'documentation',
		)
		expect(onClose).toHaveBeenCalled()
	})

	it('walks the expanded branch with the arrow keys, collapses it on a second click and dismisses it with the rest', async () => {
		const user = userEvent.setup()
		const { onClose } = renderMovableMenu(
			createRef<HTMLButtonElement>(),
			withArtifacts,
		)

		await user.click(
			screen.getByRole('menuitem', { name: 'Move to category' }),
		)
		const branch = screen.getByRole('menuitem', {
			name: 'Installers & Docs',
		})
		await user.click(branch)
		const docs = screen.getByRole('menuitem', { name: 'Docs' })

		docs.focus()
		await user.keyboard('{ArrowUp}')
		expect(document.activeElement).toBe(
			screen.getByRole('menuitem', { name: 'Installers' }),
		)
		await user.keyboard('{ArrowUp}')
		expect(document.activeElement).toBe(branch)

		await user.click(branch)
		expect(branch).toHaveAttribute('aria-expanded', 'false')
		expect(
			screen.queryByRole('menuitem', { name: 'Docs' }),
		).not.toBeInTheDocument()

		await user.pointer({ target: document.body, keys: '[MouseLeft]' })
		expect(onClose).toHaveBeenCalled()
	})

	it('opens every category in a labelled sibling menu and keeps arrow navigation continuous', async () => {
		const user = userEvent.setup()
		renderMovableMenu()

		await user.click(
			screen.getByRole('menuitem', { name: 'Move to category' }),
		)
		const categories = screen.getByRole('menu', {
			name: 'Move Visual Studio Code to category',
		})
		expect(within(categories).getAllByRole('menuitem')).toHaveLength(3)

		await user.keyboard('{ArrowDown}')
		expect(
			within(categories).getByRole('menuitem', { name: 'Games' }),
		).toHaveFocus()
	})

	it('jumps to the first and last enabled item with Home and End', async () => {
		const user = userEvent.setup()
		renderMovableMenu()
		const menu = screen.getByRole('menu', {
			name: 'Visual Studio Code actions',
		})
		const enabled = within(menu)
			.getAllByRole('menuitem')
			.filter(item => !item.hasAttribute('disabled'))

		await user.keyboard('{End}')
		expect(enabled[enabled.length - 1]).toHaveFocus()
		await user.keyboard('{Home}')
		expect(enabled[0]).toHaveFocus()
	})

	it('bounds a category list that outgrows the window so the last entries stay reachable', async () => {
		const user = userEvent.setup()
		const manyCategories: CategoryDefinition[] = Array.from(
			{ length: 16 },
			(_, index) => ({
				id: `custom-${index}`,
				label: `Custom ${index}`,
				builtIn: false,
			}),
		)
		renderMovableMenu(createRef<HTMLButtonElement>(), manyCategories)

		await user.click(
			screen.getByRole('menuitem', { name: 'Move to category' }),
		)
		const categories = screen.getByRole('menu', {
			name: 'Move Visual Studio Code to category',
		})

		expect(within(categories).getAllByRole('menuitem')).toHaveLength(16)
		expect(categories).toHaveClass(
			'max-h-[calc(100vh-1rem)]',
			'sm:max-h-[calc(100vh-1.5rem)]',
		)
		expect(categories).toHaveClass('overflow-y-auto')
	})

	it('does not dismiss the cascade before a category selection', async () => {
		const user = userEvent.setup()
		const { onClose, onMove } = renderMovableMenu()

		await user.click(
			screen.getByRole('menuitem', { name: 'Move to category' }),
		)
		const categories = screen.getByRole('menu', {
			name: 'Move Visual Studio Code to category',
		})
		await user.click(
			within(categories).getByRole('menuitem', { name: 'Browsers' }),
		)

		expect(onMove).toHaveBeenCalledWith('code', 'browsers')
		expect(onClose).toHaveBeenCalledTimes(1)
	})

	it('dismisses the cascade when a pointer event happens outside both menus', async () => {
		const user = userEvent.setup()
		const { onClose } = renderMovableMenu()

		await user.click(
			screen.getByRole('menuitem', { name: 'Move to category' }),
		)
		expect(
			screen.getByRole('menu', {
				name: 'Move Visual Studio Code to category',
			}),
		).toBeInTheDocument()
		await user.pointer({ target: document.body, keys: '[MouseLeft]' })

		expect(onClose).toHaveBeenCalledTimes(1)
	})

	// A third floating panel was clamped over the category list when the window had no room to
	// its side; the branch now grows the category panel in place and never opens another panel.
	it('keeps the category panel where it was when the branch expands and opens no third panel', async () => {
		const user = userEvent.setup()
		const viewport = {
			width: Object.getOwnPropertyDescriptor(window, 'innerWidth'),
			height: Object.getOwnPropertyDescriptor(window, 'innerHeight'),
		}
		const getBoundingClientRect = vi
			.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
			.mockImplementation(function (this: HTMLElement) {
				const label = this.getAttribute('aria-label')
				if (label === 'Actions menu anchor')
					return rect(100, 100, 32, 32)
				if (label === 'Visual Studio Code actions')
					return rect(100, 136, 224, 200)
				if (label === 'Move Visual Studio Code to category')
					return rect(328, 136, 224, 400)
				return rect(0, 0, 0, 0)
			})
		Object.defineProperty(window, 'innerWidth', {
			configurable: true,
			value: 1200,
		})
		Object.defineProperty(window, 'innerHeight', {
			configurable: true,
			value: 800,
		})

		try {
			renderMovableMenu(createRef<HTMLButtonElement>(), withArtifacts)
			await user.click(
				screen.getByRole('menuitem', { name: 'Move to category' }),
			)
			const categories = screen.getByRole('menu', {
				name: 'Move Visual Studio Code to category',
			})
			expect(categories).toHaveStyle({ left: '328px', top: '136px' })

			await user.click(
				screen.getByRole('menuitem', { name: 'Installers & Docs' }),
			)

			expect(categories).toHaveStyle({ left: '328px', top: '136px' })
			expect(screen.getAllByRole('menu')).toHaveLength(2)
			expect(
				categories.contains(
					screen.getByRole('menuitem', { name: 'Installers' }),
				),
			).toBe(true)
		} finally {
			getBoundingClientRect.mockRestore()
			if (viewport.width)
				Object.defineProperty(window, 'innerWidth', viewport.width)
			if (viewport.height)
				Object.defineProperty(window, 'innerHeight', viewport.height)
		}
	})

	// After the resize the trigger sits in the right half, so the menu hangs from the trigger's
	// right edge and the category panel moves to whichever side still has room.
	it('keeps the category panel four pixels from the menu after resize changes its viewport', async () => {
		const user = userEvent.setup()
		const anchorRef = createRef<HTMLButtonElement>()
		const viewport = {
			width: Object.getOwnPropertyDescriptor(window, 'innerWidth'),
			height: Object.getOwnPropertyDescriptor(window, 'innerHeight'),
		}
		let anchorBounds = rect(100, 100, 32, 32)
		const staleMenuBounds = rect(100, 136, 224, 200)
		const categoryBounds = rect(328, 136, 224, 150)
		const getBoundingClientRect = vi
			.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
			.mockImplementation(function (this: HTMLElement) {
				if (this.getAttribute('aria-label') === 'Actions menu anchor')
					return anchorBounds
				if (
					this.getAttribute('aria-label') ===
					'Visual Studio Code actions'
				)
					return staleMenuBounds
				if (
					this.getAttribute('aria-label') ===
					'Move Visual Studio Code to category'
				)
					return categoryBounds
				return rect(0, 0, 0, 0)
			})
		Object.defineProperty(window, 'innerWidth', {
			configurable: true,
			value: 1200,
		})
		Object.defineProperty(window, 'innerHeight', {
			configurable: true,
			value: 800,
		})

		try {
			renderMovableMenu(anchorRef)
			await user.click(
				screen.getByRole('menuitem', { name: 'Move to category' }),
			)
			const menu = screen.getByRole('menu', {
				name: 'Visual Studio Code actions',
			})
			const categories = screen.getByRole('menu', {
				name: 'Move Visual Studio Code to category',
			})

			anchorBounds = rect(500, 200, 32, 32)
			Object.defineProperty(window, 'innerWidth', {
				configurable: true,
				value: 800,
			})
			fireEvent(window, new Event('resize'))

			expect(menu).toHaveStyle({ left: '308px', top: '236px' })
			expect(categories).toHaveStyle({ left: '536px', top: '236px' })
			expect(
				Number.parseFloat(categories.style.left) -
					(Number.parseFloat(menu.style.left) + 224),
			).toBe(4)
		} finally {
			getBoundingClientRect.mockRestore()
			Object.defineProperty(window, 'innerWidth', viewport.width!)
			Object.defineProperty(window, 'innerHeight', viewport.height!)
		}
	})
})

describe('AppActionsMenu file actions', () => {
	it('runs, opens and copies an installed executable from the menu', async () => {
		const user = userEvent.setup()
		const { actions, onClose } = renderWithFileActions(visualStudioCode)

		await user.click(
			screen.getByRole('menuitem', { name: 'Run as administrator' }),
		)
		expect(actions.launchElevated).toHaveBeenCalledWith(visualStudioCode)
		expect(onClose).toHaveBeenCalledTimes(1)

		await user.click(screen.getByRole('menuitem', { name: 'Open folder' }))
		expect(actions.openFolder).toHaveBeenCalledWith(visualStudioCode)

		await user.click(screen.getByRole('menuitem', { name: 'Copy path' }))
		expect(actions.copyPath).toHaveBeenCalledWith(visualStudioCode)
	})

	it('asks Windows before offering to elevate an app id and shows it on yes', async () => {
		const actions = {
			...fileActions(),
			canLaunchElevated: vi.fn().mockResolvedValue(true),
		}
		const terminal = {
			...visualStudioCode,
			launchKind: 'app_user_model_id' as const,
			sourceKind: 'msix' as const,
			path: 'Microsoft.WindowsTerminal_8wekyb3d8bbwe!App',
		}
		renderWithFileActions(terminal, { actions })

		expect(
			await screen.findByRole('menuitem', {
				name: 'Run as administrator',
			}),
		).toBeVisible()
		expect(actions.canLaunchElevated).toHaveBeenCalledWith(terminal)
		expect(
			screen.queryByRole('menuitem', { name: 'Open folder' }),
		).not.toBeInTheDocument()
	})

	it('keeps an app id without a Windows elevation verb to Copy path', async () => {
		const actions = {
			...fileActions(),
			canLaunchElevated: vi.fn().mockResolvedValue(false),
		}
		renderWithFileActions(
			{
				...visualStudioCode,
				launchKind: 'app_user_model_id',
				path: 'Contoso.App_abc!App',
			},
			{ actions },
		)

		await vi.waitFor(() =>
			expect(actions.canLaunchElevated).toHaveBeenCalled(),
		)
		expect(
			screen.queryByRole('menuitem', { name: 'Run as administrator' }),
		).not.toBeInTheDocument()
		expect(
			screen.getByRole('menuitem', { name: 'Copy path' }),
		).toBeVisible()
	})

	it('never asks Windows about a plain executable', () => {
		const actions = { ...fileActions(), canLaunchElevated: vi.fn() }
		renderWithFileActions(visualStudioCode, { actions })

		expect(
			screen.getByRole('menuitem', { name: 'Run as administrator' }),
		).toBeVisible()
		expect(actions.canLaunchElevated).not.toHaveBeenCalled()
	})

	it('offers folder and elevation for a Windows tool listed as an app id', async () => {
		const actions = {
			...fileActions(),
			canLaunchElevated: vi.fn().mockResolvedValue(true),
		}
		renderWithFileActions(
			{
				...visualStudioCode,
				launchKind: 'app_user_model_id',
				sourceKind: 'start_apps',
				path: '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\cmd.exe',
			},
			{ actions },
		)
		expect(
			screen.getByRole('menuitem', { name: 'Open folder' }),
		).toBeVisible()
		expect(
			await screen.findByRole('menuitem', {
				name: 'Run as administrator',
			}),
		).toBeVisible()
	})

	it('does not elevate a hidden app but still locates it', () => {
		renderWithFileActions(visualStudioCode, { isHidden: true })
		expect(
			screen.queryByRole('menuitem', { name: 'Run as administrator' }),
		).not.toBeInTheDocument()
		expect(
			screen.getByRole('menuitem', { name: 'Open folder' }),
		).toBeVisible()
	})

	it('leaves installer and documentation menus without file actions', () => {
		renderWithFileActions({
			...visualStudioCode,
			artifactKind: 'installer',
			category: 'installers_docs',
		})
		for (const name of ['Run as administrator', 'Open folder', 'Copy path'])
			expect(
				screen.queryByRole('menuitem', { name }),
			).not.toBeInTheDocument()
	})

	it('hides Run as administrator when the client cannot elevate', () => {
		const { openFolder, copyPath } = fileActions()
		renderWithFileActions(visualStudioCode, {
			actions: { openFolder, copyPath },
		})
		expect(
			screen.queryByRole('menuitem', { name: 'Run as administrator' }),
		).not.toBeInTheDocument()
	})
})

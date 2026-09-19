import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { CommandPalette } from '../../../../src/features/command-palette/ui/CommandPalette/CommandPalette'
import type { AppInfo } from '../../../../src/entities/app'
import { installKnownPackageEntries } from '../../../../src/entities/app/lib/search/knownPackageIndex'

function app(id: string, name: string, publisher: string): AppInfo {
	return {
		id,
		name,
		path: `C:\\Apps\\${id}.exe`,
		category: 'other',
		iconBase64: null,
		launchKind: 'executable',
		sourceKind: 'registry',
		platformKind: null,
		description: null,
		version: null,
		publisher,
		installLocation: null,
		canUninstall: false,
	}
}

const catalog = [
	app('tidewatch', 'Orbital Tidewatch', 'Orbital Labs'),
	app('ledger', 'Fennelworks Ledger', 'Fennelworks'),
]

beforeAll(() => {
	Object.defineProperty(Element.prototype, 'scrollIntoView', {
		configurable: true,
		value: vi.fn(),
	})
})

afterEach(() => {
	installKnownPackageEntries([])
})

// The external index arrives asynchronously after the first paint. A query typed before it
// lands must recompute on its own once it is installed: no extra keystroke, no reopen.
describe('CommandPalette and the lazily loaded alias index', () => {
	it('shows external alias results for a query typed before the index was installed', async () => {
		const user = userEvent.setup()
		render(
			<CommandPalette
				apps={catalog}
				suggestions={[]}
				onLaunch={vi.fn(async () => undefined)}
				onClose={vi.fn()}
			/>,
		)
		await user.type(screen.getByRole('combobox'), 'tidectl')
		expect(screen.getByText('No apps match “tidectl”')).toBeInTheDocument()

		act(() => {
			installKnownPackageEntries([
				{
					id: 'winget:Orbital.Tidewatch',
					source: 'external',
					match: {
						anyOf: [
							{
								allOf: [
									{ name: ['orbital tidewatch'] },
									{ publisherContains: ['orbital'] },
								],
							},
						],
					},
					aliases: [['tidectl', 'normal']],
				},
			])
		})

		expect(
			screen.getByRole('option', { name: /Orbital Tidewatch/ }),
		).toBeInTheDocument()
		expect(
			screen.queryByText('No apps match “tidectl”'),
		).not.toBeInTheDocument()
	})

	it('keeps curated and generated results available before the index lands', async () => {
		const user = userEvent.setup()
		render(
			<CommandPalette
				apps={catalog}
				suggestions={[]}
				onLaunch={vi.fn(async () => undefined)}
				onClose={vi.fn()}
			/>,
		)
		await user.type(screen.getByRole('combobox'), 'ledger')
		expect(
			screen.getByRole('option', { name: /Fennelworks Ledger/ }),
		).toBeInTheDocument()
	})
})

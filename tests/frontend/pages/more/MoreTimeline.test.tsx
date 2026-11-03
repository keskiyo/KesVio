import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MorePage, type MorePageProps } from '../../../../src/pages/more'
import type { AppInfo } from '../../../../src/entities/app'

type Entry = NonNullable<MorePageProps['recentApps']>[number]

function entry(
	id: string,
	firstSeenAt: number | null,
	publisher: string | null = null,
	artifactKind?: AppInfo['artifactKind'],
): Entry {
	return {
		firstSeenAt,
		app: {
			id,
			name: id,
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
			artifactKind,
		},
	}
}

function renderRecent(recentApps: Entry[]) {
	render(
		<MorePage
			auxiliaryCount={0}
			hiddenCount={0}
			installersDocsCount={0}
			scenarioCount={0}
			catalogDiagnostics={null}
			isRefreshing={false}
			recentApps={recentApps}
			preview={{
				auxiliary: [],
				hidden: [],
				installersDocs: [],
				scenarios: [],
			}}
			scenarioRun={{
				runningId: null,
				isScenarioRunning: false,
				onRun: vi.fn(),
				onViewAll: vi.fn(),
			}}
			onSelectView={vi.fn()}
		/>,
	)
	return screen
		.getByRole('heading', { name: 'Recently added' })
		.closest('section')!
}

afterEach(() => vi.useRealTimers())

describe('More recent timeline', () => {
	it('uses spacing instead of per-row borders in the recent timeline', () => {
		const recent = renderRecent([
			entry('One', Date.now(), 'Vendor'),
			entry('Two', Date.now(), 'Vendor'),
		])
		for (const row of within(recent).getAllByRole('listitem'))
			expect(row).not.toHaveClass('border-t')
	})
	it('groups first-seen records by local calendar day and explains the date', () => {
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(new Date(2026, 10, 1, 0, 10))
		const recent = renderRecent([
			entry('Today app', new Date(2026, 10, 1, 0, 5).getTime()),
			entry('Yesterday app', new Date(2026, 9, 31, 23, 55).getTime()),
			entry('Older app', new Date(2026, 9, 29, 12).getTime()),
			entry('Unknown app', null),
		])

		expect(
			within(recent)
				.getAllByRole('heading', { level: 3 })
				.map(node => node.textContent),
		).toEqual(['Today', 'Yesterday', '29.10.2026', 'Date unknown'])
		expect(
			within(recent).getByText(
				'First seen in your catalog, not the installation date.',
			),
		).toBeInTheDocument()
		expect(
			within(recent).getByRole('list', { name: 'Today' }),
		).toHaveTextContent('Today app')
		expect(
			within(recent).getByRole('list', { name: 'Yesterday' }),
		).toHaveTextContent('Yesterday app')
		expect(recent.querySelectorAll('time')).toHaveLength(0)
	})

	it('keeps malformed dates visible under Date unknown', () => {
		const recent = renderRecent([
			entry('Missing', null),
			entry('Zero', 0),
			entry('Negative', -1),
			entry('Infinite', Infinity),
			entry('Invalid', Number.MAX_SAFE_INTEGER),
		])
		const unknown = within(recent).getByRole('list', {
			name: 'Date unknown',
		})
		expect(
			within(unknown)
				.getAllByRole('listitem')
				.map(node => node.textContent),
		).toEqual(['Missing', 'Zero', 'Negative', 'Infinite', 'Invalid'])
	})

	it('labels contiguous repeated publishers once without merging separated runs', () => {
		const recent = renderRecent([
			entry('Editor', null, 'Adobe'),
			entry('Viewer', null, 'Adobe'),
			entry('Player', null, 'Other'),
			entry('Manager', null, 'Adobe'),
			entry('No publisher', null),
		])
		const adobe = within(recent).getByRole('group', { name: 'Adobe' })
		expect(within(adobe).getAllByText('Adobe')).toHaveLength(1)
		expect(adobe).toHaveTextContent('Editor')
		expect(adobe).toHaveTextContent('Viewer')
		expect(adobe).not.toHaveTextContent('Manager')
		expect(
			within(recent).getByText('Manager').closest('li'),
		).toHaveTextContent('Adobe')
		expect(
			within(recent).getByText('Player').closest('li'),
		).toHaveTextContent('Other')
	})

	it('retains artifact labels and does not group publishers across dates', () => {
		const recent = renderRecent([
			entry(
				'Setup',
				new Date(2026, 9, 29).getTime(),
				'Vendor',
				'installer',
			),
			entry(
				'Guide',
				new Date(2026, 9, 29).getTime(),
				'Vendor',
				'documentation',
			),
			entry('Tool', new Date(2026, 9, 28).getTime(), 'Vendor'),
		])
		const vendor = within(recent).getByRole('group', { name: 'Vendor' })
		expect(vendor).toHaveTextContent('Installer')
		expect(vendor).toHaveTextContent('Documentation')
		expect(vendor).not.toHaveTextContent('Tool')
		expect(
			within(recent).getByText('Tool').closest('li'),
		).toHaveTextContent('Vendor')
	})

	it('preserves input order when a date reappears later', () => {
		const recent = renderRecent([
			entry('First', new Date(2026, 9, 29).getTime()),
			entry('Second', new Date(2026, 9, 28).getTime()),
			entry('Third', new Date(2026, 9, 29).getTime()),
		])
		expect(
			within(recent)
				.getAllByRole('listitem')
				.map(node => node.textContent),
		).toEqual(['First', 'Second', 'Third'])
	})

	it('handles explicit application kinds and keeps singleton artifact publishers attributable', () => {
		const recent = renderRecent([
			entry('Editor', null, 'Adobe', 'application'),
			entry('Viewer', null, 'Adobe', 'application'),
			entry('Setup', null, 'Other', 'installer'),
		])
		const adobe = within(recent).getByRole('group', { name: 'Adobe' })
		expect(within(adobe).getAllByText('Adobe')).toHaveLength(1)
		const setup = within(recent).getByText('Setup').closest('li')!
		expect(setup).toHaveTextContent('Installer')
		expect(setup).toHaveTextContent('Other')
	})
})

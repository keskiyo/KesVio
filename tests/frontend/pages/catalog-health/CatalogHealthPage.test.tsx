import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
	CatalogHealthPage,
	type CatalogHealthPageProps,
} from '../../../../src/pages/catalog-health'
import type {
	CatalogDiagnostics,
	SourceHealth,
} from '../../../../src/entities/app'

function health(overrides: Partial<SourceHealth> = {}): SourceHealth {
	return {
		key: 'start-menu',
		state: 'fresh',
		lastAttemptAt: 1_700_000_100,
		lastSuccessAt: 1_700_000_100,
		consecutiveFailures: 0,
		lastDurationMs: 12,
		lastError: null,
		recordCount: 40,
		...overrides,
	}
}

const healthy = [
	health({ key: 'registry' }),
	health({ key: 'start-menu' }),
	health({ key: 'portable', recordCount: 0 }),
]

function diagnostics(
	overrides: Partial<CatalogDiagnostics> = {},
): CatalogDiagnostics {
	return {
		completedAt: 1_700_000_100,
		durationMs: 1420,
		mode: 'refresh',
		totalApps: 184,
		sourceCounts: { registry: 9, 'start-menu': 175 },
		added: 3,
		removed: 1,
		updated: 2,
		sources: healthy,
		...overrides,
	}
}

function renderPage(overrides: Partial<CatalogHealthPageProps> = {}) {
	const props: CatalogHealthPageProps = {
		diagnostics: diagnostics(),
		isRefreshing: false,
		onRefresh: vi.fn().mockResolvedValue(undefined),
		onPreviewDiagnostics: vi
			.fn()
			.mockResolvedValue('<diagnostics redacted="true" />'),
		onExportDiagnostics: vi.fn().mockResolvedValue(true),
		onBack: vi.fn(),
		...overrides,
	}
	const view = render(<CatalogHealthPage {...props} />)
	return { ...view, props }
}

describe('CatalogHealthPage', () => {
	it('returns to More from a header that carries no count', async () => {
		const { props } = renderPage()

		await userEvent.click(
			screen.getByRole('button', { name: 'Back to More' }),
		)

		expect(props.onBack).toHaveBeenCalledOnce()
		const header = screen
			.getByRole('heading', { name: 'Catalog Health' })
			.closest('header')!
		expect(header).not.toHaveTextContent(/\d/)
	})

	it('asks for a refresh when there is no scan data yet', () => {
		renderPage({ diagnostics: null })

		expect(
			screen.getByRole('heading', { name: 'No scan data yet' }),
		).toBeInTheDocument()
		expect(
			screen.getByText('Refresh the catalog to check its sources.'),
		).toBeInTheDocument()
		expect(screen.getByText('No scan diagnostics yet.')).toBeInTheDocument()
		expect(screen.queryByText('Applications')).not.toBeInTheDocument()
		expect(
			screen.queryByRole('button', { name: 'Source details' }),
		).not.toBeInTheDocument()
	})

	it('reads a healthy catalog from the last diagnostics only', () => {
		renderPage()

		expect(
			screen.getByRole('heading', { name: 'Everything looks good' }),
		).toBeInTheDocument()
		expect(screen.getAllByRole('status')[0]).toHaveTextContent(
			'Every catalog source answered on the last scan.',
		)
		const hero = screen
			.getByRole('heading', { name: 'Everything looks good' })
			.closest('section')!
		expect(hero).toHaveTextContent('Applications184')
		expect(hero).toHaveTextContent('Sources3 up to date')
		expect(hero).toHaveTextContent(/Last scan.+/)
		expect(hero).toHaveTextContent('Duration1.4 s')
		expect(hero).toHaveTextContent('Changes+3 · ~2 · −1')
		expect(
			screen.getByRole('button', { name: 'Source details' }),
		).toHaveAttribute('aria-expanded', 'false')
		const statuses = screen.getByRole('list', { name: 'Source status' })
		expect(within(statuses).getAllByRole('listitem')).toHaveLength(3)
		expect(statuses).toHaveTextContent('Installed programsUp to date')
	})

	// A source that could not answer is the one fact the page exists to show: it is named in
	// the summary and the table opens on its own instead of hiding behind a disclosure.
	it('names the sources that need attention and opens the details', () => {
		renderPage({
			diagnostics: diagnostics({
				sources: [
					...healthy,
					health({
						key: 'steam',
						state: 'failed_without_snapshot',
						lastError: 'provider_failed',
						lastSuccessAt: null,
						recordCount: 0,
					}),
					health({
						key: 'start-apps',
						state: 'stale',
						lastError: 'timed_out',
					}),
				],
			}),
		})

		expect(
			screen.getByRole('heading', { name: 'Catalog needs attention' }),
		).toBeInTheDocument()
		expect(screen.getAllByRole('status')[0]).toHaveTextContent(
			'2 of 5 sources need attention.',
		)
		expect(
			screen
				.getByRole('heading', { name: 'Catalog needs attention' })
				.closest('section'),
		).toHaveTextContent('Sources2 of 5 need attention')
		expect(screen.getAllByRole('status')[1]).toHaveTextContent(
			'2 of 5 sources need attention',
		)
		const statuses = screen.getByRole('list', { name: 'Source status' })
		const flagged = within(statuses)
			.getAllByRole('listitem')
			.filter(item => item.hasAttribute('data-attention'))
		expect(flagged.map(item => item.textContent)).toEqual([
			'SteamFailed',
			'Start appsUnavailable',
		])
		expect(
			screen.getByRole('button', { name: 'Source details' }),
		).toHaveAttribute('aria-expanded', 'true')
		const table = screen.getByRole('table', {
			name: 'Application source health',
		})
		const steam = within(table).getByRole('row', { name: /Steam/ })
		expect(steam).toHaveTextContent('Failed')
		expect(steam).toHaveTextContent('Never')
		expect(steam).toHaveTextContent('Did not answer; nothing to show yet')
	})

	it('runs the ordinary refresh once and blocks it while a scan runs', async () => {
		const { props, rerender } = renderPage()

		await userEvent.click(
			screen.getByRole('button', { name: 'Refresh catalog' }),
		)
		expect(props.onRefresh).toHaveBeenCalledTimes(1)
		expect(
			screen.getAllByRole('button', { name: 'Refresh catalog' }),
		).toHaveLength(1)

		rerender(<CatalogHealthPage {...props} isRefreshing />)

		expect(
			screen.getByRole('button', { name: 'Refreshing…' }),
		).toBeDisabled()
		expect(
			screen.getByRole('heading', { name: 'Refreshing catalog…' }),
		).toBeInTheDocument()
		expect(screen.getAllByRole('status')[1]).toHaveTextContent(
			'Scanning 3 sources…',
		)
	})

	it('shows the last scan in plain numbers and keeps the technical facts folded', async () => {
		renderPage({
			diagnostics: diagnostics({
				visibilityCounts: { primary: 150, auxiliary: 34 },
				unreachableFolders: 2,
				targetAvailability: {
					byReason: {
						'target.present': 10,
						'target.unverifiable.access_denied': 2,
					},
					keptByNewRule: 2,
				},
			}),
		})

		const lastScan = screen.getByRole('region', { name: 'Last scan' })
		expect(lastScan).toHaveTextContent('Applications184')
		expect(lastScan).toHaveTextContent('Added3')
		expect(lastScan).toHaveTextContent('Updated2')
		expect(lastScan).toHaveTextContent('Removed1')
		expect(lastScan).toHaveTextContent('Duration1.4 s')
		expect(lastScan).toHaveTextContent(/Completed /)

		const details = screen.getByRole('button', {
			name: 'Technical details',
		})
		expect(details).toHaveAttribute('aria-expanded', 'false')
		expect(screen.queryByText('Mode: refresh')).not.toBeInTheDocument()

		await userEvent.click(details)
		expect(details).toHaveAttribute('aria-expanded', 'true')
		expect(screen.getByText('Mode: refresh')).toBeInTheDocument()
		expect(
			screen.getByText('registry: 9 · start-menu: 175'),
		).toBeInTheDocument()
		expect(
			screen.getByText('primary: 150 · auxiliary: 34'),
		).toBeInTheDocument()
		expect(screen.getByText('Unreachable folders: 2')).toBeInTheDocument()
		expect(screen.getByText('Verified on disk')).toBeInTheDocument()
		expect(
			screen.getByText('Not checked — access denied'),
		).toBeInTheDocument()
		expect(
			screen.getByText(/Kept by the current rule: 2/),
		).toBeInTheDocument()

		await userEvent.click(details)
		fireEvent.transitionEnd(
			screen.getByText('Mode: refresh').closest('#last-scan-details')!,
			{ propertyName: 'grid-template-rows' },
		)
		expect(screen.queryByText('Mode: refresh')).not.toBeInTheDocument()
	})

	it('shows no launch-target panel when the cache predates the diff', async () => {
		renderPage()

		await userEvent.click(
			screen.getByRole('button', { name: 'Technical details' }),
		)

		expect(
			screen.queryByText('Launch target check'),
		).not.toBeInTheDocument()
	})

	// At the 446 px minimum window the metric grid has two columns: a long value ("2 of 6 need
	// attention", a full date) must wrap rather than be cut, and the fifth tile takes the whole
	// last row instead of sitting alone on the left.
	it('lets long metric values wrap and fills the last metric row on narrow windows', () => {
		renderPage({
			diagnostics: diagnostics({
				sources: [
					...healthy,
					health({
						key: 'steam',
						state: 'stale',
						lastError: 'timed_out',
					}),
				],
			}),
		})

		const hero = screen
			.getByRole('heading', { name: 'Catalog needs attention' })
			.closest('section')!
		const values = [...hero.querySelectorAll('dd')]
		expect(values).toHaveLength(5)
		for (const value of values) {
			expect(value.className).not.toMatch(/\btruncate\b/)
			expect(value.className).toMatch(/\bbreak-words\b/)
		}
		expect(values[4]!.parentElement!.className).toMatch(
			/\bcol-span-2\b.*\blg:col-span-1\b/,
		)
		const lastScan = screen.getByRole('region', { name: 'Last scan' })
		const scanValues = [...lastScan.querySelectorAll('dd')]
		expect(scanValues[4]!.parentElement!.className).toMatch(
			/\bcol-span-2\b.*\blg:col-span-1\b/,
		)
	})

	it('keeps sub-second durations in milliseconds', () => {
		renderPage({ diagnostics: diagnostics({ durationMs: 640 }) })

		expect(
			screen.getByRole('region', { name: 'Last scan' }),
		).toHaveTextContent('Duration640 ms')
	})

	// A scrollable block of text is only reachable by keyboard when it takes focus, and a screen
	// reader only announces its name when it is a landmark, not a bare `<pre>`.
	it('exposes the redacted preview as a named, focusable region', async () => {
		const { props } = renderPage()

		await userEvent.click(
			screen.getByRole('button', { name: 'Preview redacted log' }),
		)

		expect(props.onPreviewDiagnostics).toHaveBeenCalledOnce()
		const preview = await screen.findByRole('region', {
			name: 'Redacted diagnostics preview',
		})
		expect(preview).toHaveTextContent('<diagnostics redacted="true" />')
		expect(preview).toHaveAttribute('tabindex', '0')
	})

	it('reports a failed preview without the underlying error', async () => {
		renderPage({
			onPreviewDiagnostics: vi
				.fn()
				.mockRejectedValue(new Error('C:\\Users\\Example\\denied')),
		})

		await userEvent.click(
			screen.getByRole('button', { name: 'Preview redacted log' }),
		)

		const alert = await screen.findByRole('alert')
		expect(alert).toHaveTextContent(
			'Could not load the diagnostics preview.',
		)
		expect(alert.textContent).not.toContain('Example')
	})

	it('reports a saved log and re-enables the export', async () => {
		const { props } = renderPage()

		await userEvent.click(
			screen.getByRole('button', { name: 'Export log as XML' }),
		)

		expect(props.onExportDiagnostics).toHaveBeenCalledOnce()
		expect(
			await screen.findByText('Diagnostics log exported.'),
		).toBeVisible()
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: 'Export log as XML' }),
			).toBeEnabled(),
		)
	})

	it('says nothing when the save dialog is dismissed', async () => {
		const { props } = renderPage({
			onExportDiagnostics: vi.fn().mockResolvedValue(false),
		})

		await userEvent.click(
			screen.getByRole('button', { name: 'Export log as XML' }),
		)

		await waitFor(() =>
			expect(props.onExportDiagnostics).toHaveBeenCalledOnce(),
		)
		expect(
			screen.queryByText('Diagnostics log exported.'),
		).not.toBeInTheDocument()
		expect(
			screen.queryByText('Could not save the diagnostics log.'),
		).not.toBeInTheDocument()
	})

	it('keeps a failed export recoverable and shows a safe message', async () => {
		renderPage({
			onExportDiagnostics: vi
				.fn()
				.mockRejectedValue(new Error('C:\\Users\\Example\\denied')),
		})

		await userEvent.click(
			screen.getByRole('button', { name: 'Export log as XML' }),
		)

		const message = await screen.findByText(
			'Could not save the diagnostics log.',
		)
		expect(message.textContent).not.toContain('Example')
		expect(
			screen.getByRole('button', { name: 'Export log as XML' }),
		).toBeEnabled()
	})
})

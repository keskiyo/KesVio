import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CatalogSources } from '../../../../src/pages/settings/ui/sections/CatalogSources'
import type { SourceHealth } from '../../../../src/entities/app'

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

describe('CatalogSources', () => {
	it('summarizes a healthy catalog and keeps the table folded', () => {
		render(
			<CatalogSources
				sources={healthy}
				lastScanAt={1_700_000_100}
				scanning={false}
				onRefresh={vi.fn()}
			/>,
		)

		expect(screen.getByRole('status')).toHaveTextContent(
			/^3 sources · all up to date · last scan /,
		)
		expect(
			screen.getByRole('button', { name: 'Source details' }),
		).toHaveAttribute('aria-expanded', 'false')
	})

	// A source that could not answer is the one fact the page exists to show, so it is named
	// in the summary and the table opens on its own instead of hiding behind a disclosure.
	it('names the sources that need attention and opens the details', () => {
		render(
			<CatalogSources
				sources={[
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
				]}
				lastScanAt={1_700_000_100}
				scanning={false}
			/>,
		)

		expect(screen.getByRole('status')).toHaveTextContent(
			'2 of 5 sources need attention: Steam (Failed), Start apps (Unavailable)',
		)
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
		const portable = within(table).getByRole('row', {
			name: /Portable folders/,
		})
		expect(portable).toHaveTextContent('Up to date')
		expect(portable).toHaveTextContent('0')
	})

	it('runs the ordinary refresh and reads as refreshing while a scan runs', async () => {
		const onRefresh = vi.fn().mockResolvedValue(undefined)
		const { rerender } = render(
			<CatalogSources
				sources={healthy}
				lastScanAt={null}
				scanning={false}
				onRefresh={onRefresh}
			/>,
		)

		await userEvent.click(
			screen.getByRole('button', { name: 'Refresh catalog' }),
		)
		expect(onRefresh).toHaveBeenCalledTimes(1)

		rerender(
			<CatalogSources
				sources={healthy}
				lastScanAt={null}
				scanning
				onRefresh={onRefresh}
			/>,
		)

		expect(
			screen.getByRole('button', { name: 'Refreshing…' }),
		).toBeDisabled()
		expect(screen.getByRole('status')).toHaveTextContent(
			'Scanning 3 sources…',
		)
	})

	it('explains an empty catalog without inventing a status', () => {
		render(
			<CatalogSources sources={[]} lastScanAt={null} scanning={false} />,
		)

		expect(screen.getByRole('status')).toHaveTextContent(
			'No source has been scanned yet.',
		)
		expect(
			screen.queryByRole('button', { name: 'Source details' }),
		).not.toBeInTheDocument()
	})
})

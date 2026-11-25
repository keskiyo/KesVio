import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { SearchRecovery } from '../../../../src/widgets/catalog-content/ui/AppGrid/SearchRecovery'

it('does not claim old scans with no source details had no problems', async () => {
	render(
		<SearchRecovery
			activeView="all"
			searchScopeCounts={{
				all: 0,
				auxiliary: 0,
				hidden: 0,
				installersDocs: 0,
			}}
			onSelectView={vi.fn()}
			diagnostics={{
				completedAt: 1,
				durationMs: 1,
				mode: 'refresh',
				totalApps: 0,
				sourceCounts: {},
				added: 0,
				updated: 0,
				removed: 0,
			}}
		/>,
	)
	await userEvent.click(screen.getByText('Find missing app'))
	expect(
		screen.getByText('Source status is unavailable for the last scan.'),
	).toBeInTheDocument()
})

it('distinguishes a scan in progress from problems in the last scan', async () => {
	const base = {
		activeView: 'all' as const,
		searchScopeCounts: {
			all: 0,
			auxiliary: 0,
			hidden: 0,
			installersDocs: 0,
		},
		onSelectView: vi.fn(),
	}
	const { rerender } = render(<SearchRecovery {...base} isRefreshing />)
	await userEvent.click(screen.getByText('Find missing app'))
	expect(
		screen.getByText('A catalog scan is in progress.'),
	).toBeInTheDocument()
	rerender(
		<SearchRecovery
			{...base}
			diagnostics={{
				completedAt: 1,
				durationMs: 1,
				mode: 'refresh',
				totalApps: 0,
				sourceCounts: {},
				added: 0,
				updated: 0,
				removed: 0,
				unreachableFolders: 1,
			}}
		/>,
	)
	expect(
		screen.getByText('The last scan needs attention.'),
	).toBeInTheDocument()
})

import { render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useTrayScenarios } from '../../../src/app/model/useTrayScenarios'
import type { Scenario } from '../../../src/entities/scenario'

type Handler = (id: string) => void

function scenario(value: Partial<Scenario> & Pick<Scenario, 'id'>): Scenario {
	return {
		name: value.id,
		launchIdentities: [],
		closeIdentities: [],
		createdAt: null,
		...value,
	}
}

function client(overrides: Record<string, unknown> = {}) {
	return {
		setTrayScenarios: vi.fn().mockResolvedValue(undefined),
		setTrayRunning: vi.fn().mockResolvedValue(undefined),
		onTrayScenarioRun: vi.fn().mockResolvedValue(() => undefined),
		...overrides,
	}
}

function Harness(props: Parameters<typeof useTrayScenarios>[0]) {
	useTrayScenarios(props)
	return null
}

function renderHook(
	props: Partial<Parameters<typeof useTrayScenarios>[0]> & {
		systemClient: Parameters<typeof useTrayScenarios>[0]['systemClient']
	},
) {
	const onRun = props.onRun ?? vi.fn()
	const view = render(
		<Harness
			scenarios={props.scenarios ?? []}
			favoriteScenarioIds={props.favoriteScenarioIds ?? []}
			runningName={props.runningName ?? null}
			systemClient={props.systemClient}
			onRun={onRun}
		/>,
	)
	return { ...view, onRun }
}

describe('useTrayScenarios', () => {
	it('hands the tray the scenarios it should offer', async () => {
		const systemClient = client()

		renderHook({
			systemClient,
			scenarios: [scenario({ id: 'work', name: 'Work' })],
			favoriteScenarioIds: ['work'],
		})

		await waitFor(() =>
			expect(systemClient.setTrayScenarios).toHaveBeenCalledWith([
				{ id: 'work', label: 'Work', favorite: true },
			]),
		)
	})

	// Rebuilding a native menu on every unrelated store write would flicker the open menu.
	it('rebuilds the menu only when the offered list actually changes', async () => {
		const systemClient = client()
		const scenarios = [scenario({ id: 'work', name: 'Work' })]
		const { rerender } = renderHook({
			systemClient,
			scenarios,
			favoriteScenarioIds: ['work'],
		})
		await waitFor(() =>
			expect(systemClient.setTrayScenarios).toHaveBeenCalledOnce(),
		)

		rerender(
			<Harness
				scenarios={[...scenarios]}
				favoriteScenarioIds={['work']}
				runningName={null}
				systemClient={systemClient}
				onRun={vi.fn()}
			/>,
		)

		expect(systemClient.setTrayScenarios).toHaveBeenCalledOnce()
	})

	it('adds starred scenarios and removes them immediately when unstarred', async () => {
		const systemClient = client()
		const scenarios = [
			scenario({ id: 'work', name: 'Work', lastRunAt: 10 }),
		]
		const { rerender } = renderHook({ systemClient, scenarios })
		await waitFor(() =>
			expect(systemClient.setTrayScenarios).toHaveBeenLastCalledWith([]),
		)

		for (const favoriteScenarioIds of [['work'], []]) {
			rerender(
				<Harness
					scenarios={scenarios}
					favoriteScenarioIds={favoriteScenarioIds}
					runningName={null}
					systemClient={systemClient}
					onRun={vi.fn()}
				/>,
			)
			await waitFor(() =>
				expect(systemClient.setTrayScenarios).toHaveBeenLastCalledWith(
					favoriteScenarioIds.length
						? [{ id: 'work', label: 'Work', favorite: true }]
						: [],
				),
			)
		}
	})

	it('shows the running scenario in the tooltip and clears it afterwards', async () => {
		const systemClient = client()
		const { rerender } = renderHook({ systemClient, runningName: 'Work' })
		await waitFor(() =>
			expect(systemClient.setTrayRunning).toHaveBeenCalledWith('Work'),
		)

		rerender(
			<Harness
				scenarios={[]}
				favoriteScenarioIds={[]}
				runningName={null}
				systemClient={systemClient}
				onRun={vi.fn()}
			/>,
		)

		await waitFor(() =>
			expect(systemClient.setTrayRunning).toHaveBeenLastCalledWith(null),
		)
	})

	it('runs the scenario the tray reports', async () => {
		let handler: Handler | undefined
		const systemClient = client({
			onTrayScenarioRun: vi.fn().mockImplementation((given: Handler) => {
				handler = given
				return Promise.resolve(() => undefined)
			}),
		})
		const { onRun } = renderHook({ systemClient })
		await waitFor(() => expect(handler).toBeDefined())

		handler?.('work')

		expect(onRun).toHaveBeenCalledWith('work')
	})

	it('stops listening when the window goes away', async () => {
		const stop = vi.fn()
		const systemClient = client({
			onTrayScenarioRun: vi.fn().mockResolvedValue(stop),
		})
		const { unmount } = renderHook({ systemClient })
		await waitFor(() =>
			expect(systemClient.onTrayScenarioRun).toHaveBeenCalledOnce(),
		)

		unmount()

		await waitFor(() => expect(stop).toHaveBeenCalledOnce())
	})

	// Outside the desktop runtime the tray simply is not there; that is not an error to report.
	it('stays quiet when the runtime offers no tray', async () => {
		const systemClient = client({
			setTrayScenarios: vi
				.fn()
				.mockRejectedValue(new Error('no runtime')),
			setTrayRunning: vi.fn().mockRejectedValue(new Error('no runtime')),
			onTrayScenarioRun: vi
				.fn()
				.mockRejectedValue(new Error('no runtime')),
		})

		expect(() =>
			renderHook({
				systemClient,
				scenarios: [scenario({ id: 'work' })],
			}),
		).not.toThrow()
		await waitFor(() =>
			expect(systemClient.setTrayScenarios).toHaveBeenCalledOnce(),
		)
	})

	it('does nothing at all when the client has no tray methods', () => {
		expect(() => renderHook({ systemClient: {} })).not.toThrow()
	})
})

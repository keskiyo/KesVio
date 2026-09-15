import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StartupSettingsRow } from '../../../../src/pages/settings/ui/sections/StartupSettingsRow'

const SWITCH = { name: 'Launch KesVio when Windows starts' }

describe('StartupSettingsRow', () => {
	it('shows an enabled entry as switched on and asks to switch it off', async () => {
		const onSetStartupEnabled = vi.fn().mockResolvedValue(undefined)
		render(
			<StartupSettingsRow
				startupEntry="enabled"
				saving={false}
				onSetStartupEnabled={onSetStartupEnabled}
			/>,
		)
		expect(screen.getByRole('switch', SWITCH)).toBeChecked()
		expect(
			screen.getByText(
				'KesVio starts hidden in the tray when you sign in.',
			),
		).toBeInTheDocument()

		await userEvent.click(screen.getByRole('switch', SWITCH))

		expect(onSetStartupEnabled).toHaveBeenCalledWith(false)
	})

	it('shows a disabled entry as switched off and asks to switch it on', async () => {
		const onSetStartupEnabled = vi.fn().mockResolvedValue(undefined)
		render(
			<StartupSettingsRow
				startupEntry="disabled"
				saving={false}
				onSetStartupEnabled={onSetStartupEnabled}
			/>,
		)
		expect(screen.getByRole('switch', SWITCH)).not.toBeChecked()
		expect(
			screen.getByText('KesVio starts only when you open it.'),
		).toBeInTheDocument()

		await userEvent.click(screen.getByRole('switch', SWITCH))

		expect(onSetStartupEnabled).toHaveBeenCalledWith(true)
	})

	it('disables the switch and explains when the Windows entry is missing', async () => {
		const onSetStartupEnabled = vi.fn().mockResolvedValue(undefined)
		render(
			<StartupSettingsRow
				startupEntry="missing"
				saving={false}
				onSetStartupEnabled={onSetStartupEnabled}
			/>,
		)
		const toggle = screen.getByRole('switch', SWITCH)
		expect(toggle).toBeDisabled()
		expect(toggle).not.toBeChecked()
		expect(
			screen.getByText(
				'The Windows startup entry is missing. Reinstall KesVio to restore it.',
			),
		).toBeInTheDocument()

		await userEvent.click(toggle)

		expect(onSetStartupEnabled).not.toHaveBeenCalled()
	})

	it('waits for settings and for a pending save', () => {
		const { rerender } = render(
			<StartupSettingsRow
				startupEntry={null}
				saving={false}
				onSetStartupEnabled={vi.fn()}
			/>,
		)
		expect(screen.getByRole('switch', SWITCH)).toBeDisabled()

		rerender(
			<StartupSettingsRow
				startupEntry="enabled"
				saving
				onSetStartupEnabled={vi.fn()}
			/>,
		)
		expect(screen.getByRole('switch', SWITCH)).toBeDisabled()
	})
})

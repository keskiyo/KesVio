import { useState, type KeyboardEvent } from 'react'
import { Keyboard, Pencil, RotateCcw } from 'lucide-react'
import { ACTION_BUTTON } from '../../../../shared/ui/buttonVariants'
import { SettingsRow } from '../components/SettingsRow'
import type { GlobalShortcutBinding } from '../../../../entities/system'
import type { GlobalShortcutRowProps } from '../../types'

const DEFAULT_BINDING: GlobalShortcutBinding = {
	win: true,
	ctrl: false,
	alt: false,
	shift: true,
	key: 'KeyQ',
}
const DEFAULT_LABEL = 'Win+Shift+Q'
const SUPPORTED_KEY = /^(Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2]))$/

function bindingFromEvent(
	event: KeyboardEvent<HTMLButtonElement>,
): GlobalShortcutBinding | null {
	if (!SUPPORTED_KEY.test(event.code)) return null
	const binding = {
		win: event.metaKey,
		ctrl: event.ctrlKey,
		alt: event.altKey,
		shift: event.shiftKey,
		key: event.code,
	}
	if (!binding.win && !binding.ctrl && !binding.alt) return null
	if (
		!binding.win &&
		binding.ctrl &&
		!binding.alt &&
		((!binding.shift && binding.key === 'KeyF') || binding.key === 'KeyK')
	)
		return null
	return binding
}

export function GlobalShortcutRow({
	shortcut,
	saving,
	onSetGlobalShortcut,
}: GlobalShortcutRowProps) {
	const [recording, setRecording] = useState(false)
	const [invalid, setInvalid] = useState(false)
	const label = shortcut?.label ?? DEFAULT_LABEL
	function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
		if (!recording) return
		event.preventDefault()
		if (event.key === 'Escape') {
			setRecording(false)
			setInvalid(false)
			return
		}
		if (event.key === 'Backspace') {
			setRecording(false)
			setInvalid(false)
			void onSetGlobalShortcut(DEFAULT_BINDING)
			return
		}
		if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return
		const binding = bindingFromEvent(event)
		if (!binding) {
			setInvalid(true)
			return
		}
		setRecording(false)
		setInvalid(false)
		void onSetGlobalShortcut(binding)
	}
	return (
		<SettingsRow
			icon={Keyboard}
			title="Show KesVio"
			description={
				recording
					? invalid
						? 'Use A-Z, 0-9 or F1-F12 with Win, Ctrl or Alt.'
						: 'Press a shortcut. Esc cancels.'
					: 'Works from anywhere in Windows.'
			}
		>
			<div
				role="group"
				aria-label="Global shortcut"
				className="flex w-full overflow-hidden rounded-xl border border-(--border-neutral) bg-(--surface-inset) sm:w-auto"
			>
				<kbd className="flex min-w-0 flex-1 items-center justify-center truncate px-4 py-2.5 font-mono text-sm font-medium text-(--text-primary) sm:min-w-36">
					{label}
				</kbd>
				<button
					type="button"
					aria-label={`Change global shortcut, currently ${label}`}
					aria-pressed={recording}
					disabled={saving}
					onClick={() => {
						setRecording(true)
						setInvalid(false)
					}}
					onBlur={() => setRecording(false)}
					onKeyDown={handleKeyDown}
					className={`${ACTION_BUTTON} !rounded-none border-l border-(--border-neutral) text-violet-700 hover:bg-(--surface-raised) focus-visible:outline-violet-500`}
				>
					<Pencil size={16} aria-hidden="true" />
					{recording ? 'Press keys' : 'Change'}
				</button>
				{label !== DEFAULT_LABEL && (
					<button
						type="button"
						aria-label="Restore default shortcut"
						title="Restore default shortcut"
						disabled={saving}
						onClick={() =>
							void onSetGlobalShortcut(DEFAULT_BINDING)
						}
						className={`${ACTION_BUTTON} !rounded-none border-l border-(--border-neutral) px-3 text-(--text-muted) hover:bg-(--surface-raised) focus-visible:outline-violet-500`}
					>
						<RotateCcw size={16} aria-hidden="true" />
					</button>
				)}
			</div>
		</SettingsRow>
	)
}

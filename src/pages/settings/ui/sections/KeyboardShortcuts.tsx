import { Command, ListChecks, Search } from 'lucide-react'
import { ROW_CHIP, SETTINGS_SECTION_LABEL, SETTINGS_SURFACE } from '../../data'
import { SettingsRow } from '../components/SettingsRow'
import { GlobalShortcutRow } from './GlobalShortcutRow'
import type { KeyboardShortcutsProps } from '../../types'

export function KeyboardShortcuts({
	shortcut,
	saving,
	onSetGlobalShortcut,
}: KeyboardShortcutsProps) {
	return (
		<section aria-label="Keyboard shortcuts" className={SETTINGS_SURFACE}>
			<p className={SETTINGS_SECTION_LABEL}>Keyboard shortcuts</p>
			<GlobalShortcutRow
				shortcut={shortcut}
				saving={saving}
				onSetGlobalShortcut={onSetGlobalShortcut}
			/>
			<SettingsRow
				icon={Search}
				title="Search"
				description="Focuses the search field inside KesVio."
			>
				<kbd className={ROW_CHIP}>Ctrl+F</kbd>
			</SettingsRow>
			<SettingsRow
				icon={Command}
				title="Quick launcher"
				description="Opens apps from any KesVio view."
			>
				<kbd className={ROW_CHIP}>Ctrl+K</kbd>
			</SettingsRow>
			<SettingsRow
				icon={ListChecks}
				title="Scenario launcher"
				description="Opens scenarios from any KesVio view."
			>
				<kbd className={ROW_CHIP}>Ctrl+Shift+K</kbd>
			</SettingsRow>
			{shortcut?.error && (
				<p className="border-t border-slate-200 px-5 py-3 text-sm text-amber-700">
					{shortcut.error}
				</p>
			)}
		</section>
	)
}

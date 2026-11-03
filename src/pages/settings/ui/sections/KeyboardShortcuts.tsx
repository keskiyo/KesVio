import { ROW_CHIP, SETTINGS_SECTION_LABEL, SETTINGS_SURFACE } from '../../data'
import { ShortcutRow } from '../components/ShortcutRow'
import { GlobalShortcutRow } from './GlobalShortcutRow/GlobalShortcutRow'
import type { KeyboardShortcutsProps } from '../../types'

export function KeyboardShortcuts({
	shortcut,
	saving,
	error,
	onSetGlobalShortcut,
}: KeyboardShortcutsProps) {
	return (
		<section
			id="settings-shortcuts"
			aria-label="Keyboard shortcuts"
			tabIndex={-1}
			className={`${SETTINGS_SURFACE} scroll-mt-5 focus-visible:outline-2 focus-visible:outline-(--accent)`}
		>
			<h2 className={SETTINGS_SECTION_LABEL}>Keyboard shortcuts</h2>
			<dl>
				<GlobalShortcutRow
					shortcut={shortcut}
					saving={saving}
					error={error}
					onSetGlobalShortcut={onSetGlobalShortcut}
				/>
				<ShortcutRow title="Search">
					<kbd className={ROW_CHIP}>Ctrl+F</kbd>
					<span className="sr-only">
						Focuses the search field inside KesVio.
					</span>
				</ShortcutRow>
				<ShortcutRow title="Quick launcher">
					<kbd className={ROW_CHIP}>Ctrl+K</kbd>
					<span className="sr-only">
						Opens apps from any KesVio view.
					</span>
				</ShortcutRow>
				<ShortcutRow title="Scenario launcher">
					<kbd className={ROW_CHIP}>Ctrl+Shift+K</kbd>
					<span className="sr-only">
						Opens scenarios from any KesVio view.
					</span>
				</ShortcutRow>
			</dl>
			{shortcut?.error && (
				<p
					role="status"
					className="border-t border-(--border-neutral) px-5 py-3 text-sm text-(--category-amber)"
				>
					{shortcut.error}
				</p>
			)}
		</section>
	)
}

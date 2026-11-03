import { SETTINGS_SECTION_LABEL, SETTINGS_SURFACE } from '../../data'
import type { CatalogSettingsProps } from '../../types'
import { CatalogMaintenance } from './CatalogMaintenance'
import { SettingsDiscoveryControls } from './SettingsDiscoveryControls'

export function CatalogSettings({
	discovery,
	maintenance,
}: CatalogSettingsProps) {
	return (
		<section
			id="settings-catalog"
			aria-label="Catalog"
			tabIndex={-1}
			className={`${SETTINGS_SURFACE} scroll-mt-5 focus-visible:outline-2 focus-visible:outline-(--accent)`}
		>
			<p className={SETTINGS_SECTION_LABEL}>Catalog</p>
			<SettingsDiscoveryControls {...discovery} />
			{maintenance && <CatalogMaintenance {...maintenance} />}
		</section>
	)
}

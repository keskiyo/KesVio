import { SETTINGS_SECTION_LABEL, SETTINGS_SURFACE } from '../../data'
import type { CatalogSettingsProps } from '../../types'
import { CatalogMaintenance } from './CatalogMaintenance'
import { SettingsDiscoveryControls } from './SettingsDiscoveryControls'

export function CatalogSettings({
	discovery,
	maintenance,
}: CatalogSettingsProps) {
	return (
		<section aria-label="Catalog" className={SETTINGS_SURFACE}>
			<p className={SETTINGS_SECTION_LABEL}>Catalog</p>
			<SettingsDiscoveryControls {...discovery} />
			{maintenance && <CatalogMaintenance {...maintenance} />}
		</section>
	)
}

import type { AppSidebarProps } from '../types'
import { AppNavigation } from './AppNavigation/AppNavigation'
import { NavigationIdentity } from './NavigationIdentity'

export function AppSidebar({
	identity,
	onGoHome,
	...navigation
}: AppSidebarProps) {
	return (
		<aside className="app-sidebar z-350 row-span-2 grid min-h-0 w-70 grid-cols-[minmax(0,1fr)] grid-rows-subgrid overflow-hidden">
			<div className="app-sidebar-brand flex items-center px-4 py-4">
				<NavigationIdentity {...identity} onGoHome={onGoHome} />
			</div>
			<AppNavigation {...navigation} />
		</aside>
	)
}

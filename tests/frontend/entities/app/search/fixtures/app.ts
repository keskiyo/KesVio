import type { AppInfo } from '../../../../../../src/entities/app'

export type AppSeed = Partial<AppInfo> & Pick<AppInfo, 'id' | 'name'>

export function app(value: AppSeed): AppInfo {
	return {
		path: `C:\\Apps\\${value.id}\\app.exe`,
		category: 'other',
		iconBase64: null,
		launchKind: 'executable',
		sourceKind: 'registry',
		platformKind: null,
		description: null,
		version: null,
		publisher: null,
		installLocation: null,
		canUninstall: false,
		...value,
	}
}

export function shortcut(
	value: AppSeed & Pick<AppInfo, 'originalFilename'>,
): AppInfo {
	return app({
		path: `C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\${value.name}.lnk`,
		launchKind: 'shortcut',
		sourceKind: 'start_menu',
		...value,
	})
}

export function msix(
	value: AppSeed & { family: string; productName: string },
): AppInfo {
	const { family, ...rest } = value
	return app({
		path: `${family}!App`,
		launchKind: 'app_user_model_id',
		sourceKind: 'msix',
		platformKind: 'microsoft_store',
		...rest,
	})
}

export const ids = (apps: AppInfo[]) => apps.map(entry => entry.id)

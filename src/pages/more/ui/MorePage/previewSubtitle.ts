import type { AppInfo } from '../../../../entities/app'
import type { MorePreviewRowProps } from './types'

export function previewSubtitleOf(
	app: AppInfo,
	context: MorePreviewRowProps['context'] = 'destination',
): string | null {
	const artifact =
		app.artifactKind === 'installer'
			? 'Installer'
			: app.artifactKind === 'documentation'
				? 'Documentation'
				: null
	if (context === 'publisher-group') return artifact
	if (context === 'timeline')
		return [app.publisher, artifact].filter(Boolean).join(' · ') || null
	return artifact ?? app.publisher
}

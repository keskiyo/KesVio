import { Copy, FolderOpen, ShieldCheck } from 'lucide-react'
import { canOpenFolderFromMenu } from '../../../../entities/app'
import { MenuItem } from './MenuItem'
import type { FileActionItemsProps } from './types'
import { useElevationOffer } from './useElevationOffer'

export function FileActionItems({
	app,
	isHidden,
	fileActions,
	onClose,
}: FileActionItemsProps) {
	const { launchElevated } = fileActions
	const elevationOffered = useElevationOffer(app, isHidden, fileActions)
	return (
		<>
			{elevationOffered && launchElevated && (
				<MenuItem
					icon={ShieldCheck}
					label="Run as administrator"
					onClick={() => {
						onClose()
						void launchElevated(app)
					}}
				/>
			)}
			{canOpenFolderFromMenu(app) && (
				<MenuItem
					icon={FolderOpen}
					label="Open folder"
					onClick={() => {
						onClose()
						void fileActions.openFolder(app)
					}}
				/>
			)}
			<MenuItem
				icon={Copy}
				label="Copy path"
				onClick={() => {
					onClose()
					void fileActions.copyPath(app)
				}}
			/>
		</>
	)
}

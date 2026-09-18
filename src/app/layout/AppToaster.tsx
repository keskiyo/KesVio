import { Toaster } from 'sonner'

export function AppToaster() {
	return (
		<Toaster
			className="app-toaster"
			theme="dark"
			position="bottom-right"
			expand
			visibleToasts={5}
			gap={10}
			offset={16}
			closeButton
		/>
	)
}

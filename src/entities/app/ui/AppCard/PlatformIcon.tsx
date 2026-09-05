import { Gamepad2, ShoppingBag } from 'lucide-react'
import type { PlatformIconProps } from './types'

function PortableIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
			data-platform-icon="portable"
			className="app-card-platform-icon"
		>
			<path
				d="M8 8V3h8v5"
				stroke="currentColor"
				strokeWidth="1.8"
				strokeLinejoin="round"
			/>
			<rect
				x="6"
				y="8"
				width="12"
				height="13"
				rx="2"
				stroke="currentColor"
				strokeWidth="1.8"
			/>
			<path d="M10 3v3m4-3v3" stroke="currentColor" strokeWidth="1.8" />
		</svg>
	)
}

export function PlatformIcon({ platformKind }: PlatformIconProps) {
	if (platformKind === 'microsoft_store')
		return (
			<ShoppingBag
				aria-hidden="true"
				data-platform-icon="microsoft_store"
				className="app-card-platform-icon"
			/>
		)
	if (platformKind === 'portable') return <PortableIcon />

	return (
		<Gamepad2
			aria-hidden="true"
			data-platform-icon={platformKind}
			className="app-card-platform-icon"
		/>
	)
}

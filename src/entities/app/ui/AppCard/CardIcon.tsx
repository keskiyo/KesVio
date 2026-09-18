import { AppWindow, Loader2 } from 'lucide-react'
import type { CardIconProps } from './types'

const TONE_RING = {
	accent: 'ring-violet-300/70',
	neutral:
		'ring-(--border-neutral) transition-shadow group-hover:ring-(--accent)/60 group-focus-within:ring-(--accent)/60 motion-reduce:transition-none',
}

export function CardIcon({
	iconBase64,
	launching,
	tone = 'accent',
}: CardIconProps) {
	return (
		<span
			className={`app-card-icon relative grid shrink-0 place-items-center rounded-xl bg-white/52 shadow-(--shadow-app-icon) ring-1 ring-inset ${TONE_RING[tone]}`}
		>
			<span
				className={
					launching ? 'opacity-40 grayscale transition' : 'transition'
				}
			>
				{iconBase64 ? (
					<img
						src={iconBase64}
						alt=""
						className="app-card-icon-image object-contain"
						draggable={false}
					/>
				) : (
					<AppWindow
						className="app-card-icon-image text-slate-500 transition-colors group-hover:text-violet-600"
						aria-hidden="true"
					/>
				)}
			</span>
			{launching && (
				<Loader2
					size={22}
					className="absolute animate-spin text-violet-500"
					aria-hidden="true"
				/>
			)}
		</span>
	)
}

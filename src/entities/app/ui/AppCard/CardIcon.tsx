import { AppWindow, Loader2 } from 'lucide-react'
import type { CardIconProps } from './types'

export function CardIcon({ iconBase64, launching }: CardIconProps) {
	return (
		<span className="app-card-icon relative grid shrink-0 place-items-center rounded-xl bg-white/52 shadow-(--shadow-app-icon) ring-1 ring-violet-300/70 ring-inset">
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

export function Skeleton() {
	return (
		<div className="app-card-tile app-card-face flex animate-pulse flex-col items-center justify-center border border-white/80 bg-white/48 shadow-(--shadow-skeleton)">
			<div className="app-card-icon rounded-xl bg-slate-300/70" />
			<div className="h-3 w-2/3 rounded-full bg-slate-300/70" />
		</div>
	)
}

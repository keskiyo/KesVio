export interface CardBox {
	left: number
	top: number
	width: number
	height: number
}

export type CardDirection = 'left' | 'right' | 'up' | 'down'

function centerX(box: CardBox) {
	return box.left + box.width / 2
}

function centerY(box: CardBox) {
	return box.top + box.height / 2
}

export function nextCardIndex(
	boxes: CardBox[],
	current: number,
	direction: CardDirection,
): number | null {
	const origin = boxes[current]
	if (!origin) return null
	if (direction === 'left') return current > 0 ? current - 1 : null
	if (direction === 'right')
		return current < boxes.length - 1 ? current + 1 : null
	const below = direction === 'down'
	const candidates = boxes
		.map((box, index) => ({ box, index }))
		.filter(({ box }) =>
			below
				? centerY(box) > origin.top + origin.height
				: centerY(box) < origin.top,
		)
	if (!candidates.length) return null
	const rowDistance = ({ box }: { box: CardBox }) =>
		Math.abs(centerY(box) - centerY(origin))
	const nearestRow = Math.min(...candidates.map(rowDistance))
	const row = candidates.filter(
		candidate => rowDistance(candidate) - nearestRow < origin.height / 2,
	)
	return row.reduce((best, candidate) =>
		Math.abs(centerX(candidate.box) - centerX(origin)) <
		Math.abs(centerX(best.box) - centerX(origin))
			? candidate
			: best,
	).index
}

import { useCallback, useEffect, useRef, useState } from 'react'

interface RowMetrics {
	fitted: number
	rowEnd: number
	rowHeight: number
	fullHeight: number
}

const UNMEASURED: RowMetrics = {
	fitted: 0,
	rowEnd: 0,
	rowHeight: 0,
	fullHeight: 0,
}

function measureRows(node: HTMLElement): RowMetrics {
	const tiles = [...node.children].filter(
		(child): child is HTMLElement => child instanceof HTMLElement,
	)
	const top = tiles[0]?.offsetTop
	if (top === undefined) return UNMEASURED
	const firstRow = tiles.filter(tile => tile.offsetTop === top)
	return {
		fitted: firstRow.length,
		rowEnd: Math.max(
			...firstRow.map(tile => tile.offsetLeft + tile.offsetWidth),
		),
		rowHeight: Math.max(...firstRow.map(tile => tile.offsetHeight)),
		fullHeight: node.scrollHeight,
	}
}

function same(left: RowMetrics, right: RowMetrics): boolean {
	return (
		left.fitted === right.fitted &&
		left.rowEnd === right.rowEnd &&
		left.rowHeight === right.rowHeight &&
		left.fullHeight === right.fullHeight
	)
}

/**
 * Reports the row a wrapping list actually produced rather than one calculated from widths.
 *
 * The list itself never changes size — it always fills its container — so watching it alone misses
 * everything that decides where the row breaks: the tiles taking their styles, an icon arriving,
 * an entry being added. Every tile is observed as well, and a measurement stays only when it says
 * something new, so the observer cannot drive a render loop.
 *
 * Every item stays in the list and stays laid out, whatever the caller then hides: a reading taken
 * from a list that had already been shortened would only ever confirm the shorter list, and each
 * pass would take another item away.
 */
export function useTileRowLimit(count: number) {
	const [metrics, setMetrics] = useState(UNMEASURED)
	const nodeRef = useRef<HTMLElement | null>(null)
	const observerRef = useRef<ResizeObserver | null>(null)

	const watch = useCallback(() => {
		observerRef.current?.disconnect()
		observerRef.current = null
		const node = nodeRef.current
		if (!node) return
		const measure = () =>
			setMetrics(current => {
				const next = measureRows(node)
				return same(current, next) ? current : next
			})
		measure()
		if (typeof ResizeObserver === 'undefined') return
		const observer = new ResizeObserver(measure)
		observer.observe(node)
		for (const tile of node.children) observer.observe(tile)
		observerRef.current = observer
	}, [])

	const ref = useCallback(
		(node: HTMLElement | null) => {
			nodeRef.current = node
			watch()
		},
		[watch],
	)

	useEffect(watch, [count, watch])

	useEffect(
		() => () => {
			observerRef.current?.disconnect()
			observerRef.current = null
		},
		[],
	)

	return { ref, ...metrics }
}

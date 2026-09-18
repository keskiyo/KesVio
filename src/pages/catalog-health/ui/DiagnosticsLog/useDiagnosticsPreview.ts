import { useEffect, useRef, useState } from 'react'

export function useDiagnosticsPreview(read: () => Promise<string>) {
	const generation = useRef(0)
	const pending = useRef(false)
	const [text, setText] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	useEffect(
		() => () => {
			generation.current += 1
		},
		[],
	)
	async function show() {
		if (pending.current) return
		pending.current = true
		const current = ++generation.current
		setLoading(true)
		setError(null)
		setText(null)
		try {
			const value = await read()
			if (current === generation.current) setText(value)
		} catch {
			if (current === generation.current)
				setError('Could not load the diagnostics preview.')
		} finally {
			if (current === generation.current) {
				setLoading(false)
				pending.current = false
			}
		}
	}
	return { text, loading, error, show }
}

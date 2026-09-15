import type { AppInfo } from '../../src/entities/app'

const PRODUCTS = [
	'Visual Studio Code',
	'Photoshop',
	'Steam',
	'Google Chrome',
	'Microsoft Word',
	'Blender',
	'OBS Studio',
	'Telegram Desktop',
	'Discord',
	'7-Zip File Manager',
	'Notepad++',
	'Git Bash',
	'Docker Desktop',
	'Spotify',
	'VLC media player',
	'Firefox',
	'Total Commander',
	'Rufus',
	'HxD',
	'Krita',
]
const PUBLISHERS = [
	'Microsoft Corporation',
	'Adobe',
	'Valve',
	'Google LLC',
	'Blender Foundation',
	'Telegram FZ-LLC',
	'Igor Pavlov',
	'Mozilla',
	'Ghisler Software',
]
const CATEGORIES = [
	'development',
	'editors',
	'games',
	'browsers',
	'productivity',
	'media',
	'communication',
	'utilities',
	'other',
]

function pseudoRandom(seed: number): () => number {
	let state = seed >>> 0
	return () => {
		state = (state * 1664525 + 1013904223) >>> 0
		return state / 0x100000000
	}
}

export function syntheticCatalog(size: number, seed = 0x5eed): AppInfo[] {
	const next = pseudoRandom(seed)
	return Array.from({ length: size }, (_, index) => {
		const product = PRODUCTS[Math.floor(next() * PRODUCTS.length)]
		const publisher = PUBLISHERS[Math.floor(next() * PUBLISHERS.length)]
		const variant = Math.floor(next() * 900) + 100
		const name = `${product} ${variant}`
		return {
			id: `path:c:\\apps\\${index}\\${product.replace(/\s+/g, '-').toLowerCase()}.exe`,
			name,
			path: `C:\\Apps\\${index}\\${product.replace(/\s+/g, '')}.exe`,
			iconBase64: null,
			category: CATEGORIES[Math.floor(next() * CATEGORIES.length)],
			launchKind: 'executable',
			sourceKind: index % 3 === 0 ? 'portable' : 'registry',
			platformKind: null,
			description: `${product} build ${variant} by ${publisher}`,
			version: `${Math.floor(next() * 20)}.${variant}`,
			publisher,
			productName: product,
			installLocation: `C:\\Apps\\${index}`,
			canUninstall: index % 2 === 0,
			preferenceIdentity: `identity:${index}`,
			visibilityClass: 'primary',
		}
	})
}

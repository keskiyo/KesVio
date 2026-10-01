import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const palette = readFileSync(
	'src/features/command-palette/ui/CommandPalette/CommandPalette.tsx',
	'utf8',
)

// The overlay centred its only grid column with `justify-center`, so the column shrank to the
// width of the rows and `w-full max-w-xl` resolved against it: Quick launch opened 292px wide in
// a 1280px window and cut every name short.
describe('Quick launch width', () => {
	it('sizes the overlay column explicitly so the panel can reach its maximum width', () => {
		const overlay = palette.match(/className="motion-overlay [^"]*"/)?.[0]
		expect(overlay).toContain('grid-cols-[minmax(0,36rem)]')
		expect(palette).toMatch(/className="motion-panel [^"]*\bw-full\b/)
	})
})

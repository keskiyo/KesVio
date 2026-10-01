import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PreferencesNotSavedBanner } from '../../../../src/app/layout/PreferencesNotSavedBanner'

describe('PreferencesNotSavedBanner', () => {
	// The banner is the only signal that preferences stopped reaching disk, and it still named the
	// product by its old working title.
	it('announces unsaved changes under the product name', () => {
		render(<PreferencesNotSavedBanner />)

		const banner = screen.getByRole('status')
		expect(banner).toHaveTextContent('Your changes are not being saved')
		expect(banner).toHaveTextContent(/lost when KesVio restarts/)
		expect(banner).not.toHaveTextContent('Windows Apps')
	})
})

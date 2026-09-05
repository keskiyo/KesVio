import { beforeEach, describe, expect, it, vi } from 'vitest'
import contract from '../../../../src-tauri/tests/fixtures/ipc/contract.json'

const recorded = contract as unknown as { errorCodes: string[] }

const invokeMock = vi.fn()
const listenMock = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
	invoke: invokeMock,
}))

vi.mock('@tauri-apps/api/event', () => ({
	listen: listenMock,
}))

describe('tauri app client browser fallback', () => {
	beforeEach(() => {
		vi.resetModules()
		invokeMock.mockReset()
		listenMock.mockReset()
		delete (globalThis as { __TAURI_INTERNALS__?: unknown })
			.__TAURI_INTERNALS__
	})

	it('does not call Tauri IPC when opened in a regular browser', async () => {
		const { tauriAppsClient } =
			await import('../../../../src/entities/app/api/appsClient')

		await expect(tauriAppsClient.getApps()).resolves.toEqual({
			apps: [],
			hasCache: false,
		})
		await expect(
			tauriAppsClient.onCatalogDelta?.(() => undefined),
		).resolves.toEqual(expect.any(Function))
		await expect(
			tauriAppsClient.getAppDetails('app-id'),
		).rejects.toMatchObject({
			code: 'DESKTOP_RUNTIME_UNAVAILABLE',
		})
		await expect(
			tauriAppsClient.openAppFolder('app-id'),
		).rejects.toMatchObject({
			code: 'DESKTOP_RUNTIME_UNAVAILABLE',
		})

		expect(invokeMock).not.toHaveBeenCalled()
		expect(listenMock).not.toHaveBeenCalled()
	})

	it('preserves structured backend error codes and hides unknown transport details', async () => {
		const { toAppClientError } =
			await import('../../../../src/shared/api/tauri/errors')
		expect(
			toAppClientError({
				code: 'LAUNCH_UNAVAILABLE',
				message: 'This application is not available for launch.',
			}),
		).toMatchObject({
			code: 'LAUNCH_UNAVAILABLE',
			message: 'This application is not available for launch.',
		})
		expect(
			toAppClientError(new Error('C:\\Users\\Example\\private-detail')),
		).toMatchObject({
			code: 'INTERNAL',
			message: 'The operation could not be completed. Try again.',
		})
	})

	// The error-code set is a cross-language contract, and it used to be pinned against a copy of
	// itself: the backend half below was a hand-maintained literal, so a code added in Rust and
	// never mirrored here left both lists agreeing with each other and disagreeing with the
	// application. `EXPORT_DIAGNOSTICS_FAILED` and `SAVE_WINDOW_SETTINGS_FAILED` sat in exactly
	// that state. The list now comes from the recorded contract, which is serialized from
	// `AppError` itself, so Rust is the only source of truth.
	it('mirrors the backend AppError code contract exactly', async () => {
		const { APP_ERROR_CODES } =
			await import('../../../../src/shared/api/tauri/errors')
		const frontendOnly = ['DESKTOP_RUNTIME_UNAVAILABLE', 'INTERNAL']

		expect(Object.keys(APP_ERROR_CODES).sort()).toEqual(
			[...recorded.errorCodes, ...frontendOnly].sort(),
		)
	})
})

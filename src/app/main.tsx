import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { AppErrorBoundary } from './AppErrorBoundary'
import { FrontendReadyGate } from './model/FrontendReadyGate'
import { FRONTEND_READY_EVENT } from './model/scheduleFrontendReady'
import { tauriAppsClient } from '../entities/app/api/appsClient'
import { tauriSystemClient } from '../entities/system/api/systemClient'
import { emitIfTauri } from '../shared/api/tauri/client'
import { createAppStore } from './store/appStore'
import './styles/index.css'

const appStore = createAppStore(tauriAppsClient)

function reportInterfaceFailure(kind: string, detail: string) {
	void tauriSystemClient.logClientError?.(kind, detail).catch(() => undefined)
}

function signalFrontendReady() {
	void emitIfTauri<void>(FRONTEND_READY_EVENT).catch(reason =>
		reportInterfaceFailure('frontend_ready', String(reason)),
	)
}

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<FrontendReadyGate signal={signalFrontendReady}>
			<AppErrorBoundary onError={reportInterfaceFailure}>
				<App
					store={appStore}
					systemClient={tauriSystemClient}
					appsClient={tauriAppsClient}
				/>
			</AppErrorBoundary>
		</FrontendReadyGate>
	</StrictMode>,
)

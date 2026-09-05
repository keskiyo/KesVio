import { useCallback, useEffect, useRef, useState } from 'react'
import type { UpdateCheckStatus } from '../types'
import type { UpdateHandle, UpdateResource } from './updateResource'
import {
	automaticCheckIsDue,
	dismissedVersion,
	failedChecks,
	rememberCheck,
	rememberDismissedVersion,
	rememberFailedChecks,
	storedAutomaticChecks,
	rememberAutomaticChecks,
} from './updatePreferences'

interface CheckRequest {
	manual: boolean
	automaticActive: () => boolean
	promise: Promise<void>
}

export function useUpdateCheck(
	check: () => Promise<UpdateHandle | null>,
	resource: UpdateResource,
	autoCheck: boolean,
) {
	const [available, setAvailable] = useState<UpdateHandle | null>(null)
	const [status, setStatus] = useState<UpdateCheckStatus>('idle')
	const [automaticChecks, setAutomaticChecksState] = useState(
		storedAutomaticChecks,
	)
	const mounted = useRef(false)
	const pending = useRef<CheckRequest | null>(null)
	useEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
			resource.replace(null)
		}
	}, [resource])

	const requestCheck = useCallback(
		(manual: boolean, automaticActive: () => boolean = () => false) => {
			if (manual && mounted.current) setStatus('checking')
			if (pending.current) {
				pending.current.manual ||= manual
				if (!manual) pending.current.automaticActive = automaticActive
				return pending.current.promise
			}
			const request: CheckRequest = {
				manual,
				automaticActive,
				promise: Promise.resolve(),
			}
			request.promise = Promise.resolve()
				.then(check)
				.then(found => {
					rememberCheck(Date.now())
					rememberFailedChecks(0)
					if (
						!mounted.current ||
						(!request.manual && !request.automaticActive())
					) {
						resource.discard(found)
						return
					}
					if (
						!request.manual &&
						(!found || dismissedVersion() === found.version)
					) {
						resource.discard(found)
						return
					}
					resource.replace(found)
					setAvailable(found)
					setStatus(found ? 'available' : 'current')
				})
				.catch(() => {
					rememberCheck(Date.now())
					rememberFailedChecks(failedChecks() + 1)
					if (mounted.current && request.manual) setStatus('error')
				})
				.finally(() => {
					if (pending.current === request) pending.current = null
				})
			pending.current = request
			return request.promise
		},
		[check, resource],
	)

	useEffect(() => {
		if (!autoCheck || !automaticChecks || !automaticCheckIsDue(Date.now()))
			return
		let active = true
		void requestCheck(false, () => active)
		return () => {
			active = false
		}
	}, [autoCheck, automaticChecks, requestCheck])

	const checkNow = useCallback(() => requestCheck(true), [requestCheck])
	const setAutomaticChecks = useCallback((enabled: boolean) => {
		rememberAutomaticChecks(enabled)
		setAutomaticChecksState(enabled)
	}, [])
	const dismiss = useCallback(() => {
		const update = resource.get()
		if (update) rememberDismissedVersion(update.version)
		resource.replace(null)
		setAvailable(null)
	}, [resource])
	return {
		available,
		status,
		automaticChecks,
		checkNow,
		setAutomaticChecks,
		dismiss,
	}
}

import type { GlobalShortcutBinding } from '../../../../../entities/system'

export type ShortcutModifier = 'win' | 'ctrl' | 'alt' | 'shift'

export type ShortcutModifiers = Record<ShortcutModifier, boolean>

export type CaptureResult =
	| { kind: 'pass' }
	| { kind: 'hold' }
	| { kind: 'cancel' }
	| { kind: 'reset' }
	| { kind: 'invalid' }
	| { kind: 'reserved'; label: string }
	| {
			kind: 'taken'
			owner: 'windows' | 'standard'
			label: string
			action: string
			suggestion: string | null
	  }
	| { kind: 'binding'; binding: GlobalShortcutBinding }

export type CaptureProblem = Extract<
	CaptureResult,
	{ kind: 'invalid' } | { kind: 'reserved' } | { kind: 'taken' }
>

export type KnownUse =
	| { kind: 'windows' | 'standard'; action: string }
	| { kind: 'risky'; effect: string }

export interface ChangeRow {
	tone: 'gain' | 'loss' | 'freed'
	keys: string
	text: string
}

export interface ShortcutConfirmDialogProps {
	candidate: GlobalShortcutBinding
	current: string
	onConfirm(): void
	onClose(): void
}

export interface ShortcutDescriptionProps {
	recording: boolean
	problem: CaptureProblem | null
	error: string | null
	attempt: GlobalShortcutBinding | null
}

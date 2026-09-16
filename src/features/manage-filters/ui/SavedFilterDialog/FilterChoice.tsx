import { Check } from 'lucide-react'
import type { ChangeEventHandler, ReactNode } from 'react'

interface FilterChoiceProps {
	type: 'checkbox' | 'radio'
	name?: string
	checked: boolean
	children: ReactNode
	truncate?: boolean
	onChange: ChangeEventHandler<HTMLInputElement>
}

export function FilterChoice({
	type,
	name,
	checked,
	children,
	truncate = false,
	onChange,
}: FilterChoiceProps) {
	return (
		<label className="group relative flex min-h-7 min-w-0 cursor-pointer items-center gap-2 rounded-lg px-1.5 text-sm text-(--text-primary) transition-colors hover:bg-(--surface-raised) motion-reduce:transition-none">
			<input
				type={type}
				name={name}
				checked={checked}
				onChange={onChange}
				className="peer sr-only"
			/>
			<span
				aria-hidden="true"
				className={`grid size-4.5 shrink-0 place-items-center border border-(--border-neutral) bg-(--surface-inset) text-white transition-colors peer-checked:border-(--accent) peer-checked:bg-(--utility-accent) peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--accent-strong) motion-reduce:transition-none ${type === 'radio' ? 'rounded-full' : 'rounded-md'}`}
			>
				{type === 'checkbox' ? (
					<Check
						size={12}
						strokeWidth={3}
						aria-hidden="true"
						className={`transition-opacity motion-reduce:transition-none ${checked ? 'opacity-100' : 'opacity-0'}`}
					/>
				) : (
					<span
						className={`size-1.5 rounded-full bg-white transition-opacity motion-reduce:transition-none ${checked ? 'opacity-100' : 'opacity-0'}`}
					/>
				)}
			</span>
			<span className={truncate ? 'min-w-0 truncate' : undefined}>
				{children}
			</span>
		</label>
	)
}

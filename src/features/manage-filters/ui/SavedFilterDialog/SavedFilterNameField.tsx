import type { RefObject } from 'react'
import { MAX_SAVED_FILTER_NAME_LENGTH } from '../../../../entities/app'
import { useSpotlight } from '../../../../shared/hooks/useSpotlight'
import { SpotlightLayer } from '../../../../shared/ui/SpotlightLayer'
import { FIELD_LABEL_CLASS } from './data'

interface SavedFilterNameFieldProps {
	inputRef: RefObject<HTMLInputElement>
	value: string
	onChange: (value: string) => void
}

export function SavedFilterNameField({
	inputRef,
	value,
	onChange,
}: SavedFilterNameFieldProps) {
	const spotlight = useSpotlight()

	return (
		<label className="grid gap-1.5">
			<span className={FIELD_LABEL_CLASS}>Name</span>
			<span
				className="relative rounded-xl"
				onPointerMove={spotlight.onPointerMove}
				onPointerEnter={spotlight.onPointerEnter}
				onPointerLeave={spotlight.onPointerLeave}
			>
				<SpotlightLayer size={150} />
				<input
					ref={inputRef}
					type="text"
					value={value}
					maxLength={MAX_SAVED_FILTER_NAME_LENGTH}
					autoComplete="off"
					spellCheck={false}
					onChange={event => onChange(event.target.value)}
					className="search-input h-11 w-full rounded-xl border border-(--border-neutral) bg-(--surface-inset) px-3 text-sm text-(--text-primary) outline-none"
				/>
			</span>
		</label>
	)
}

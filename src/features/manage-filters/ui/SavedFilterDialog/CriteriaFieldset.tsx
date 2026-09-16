import type { AvailabilityBucket } from '../../../../entities/app'
import type { AppSourceKind } from '../../../../entities/app'
import {
	ADDED_WITHIN_OPTIONS,
	AVAILABILITY_CHOICES,
	FIELD_LABEL_CLASS,
	SOURCE_CHOICES,
	SOURCE_HINT,
} from './data'
import { FilterChoice } from './FilterChoice'
import { FilterDisclosure } from './FilterDisclosure'
import { PublisherCriteria } from './PublisherCriteria'
import type { CriteriaFieldsetProps } from './types'

function toggled<T>(list: T[], value: T, checked: boolean): T[] {
	if (checked) return list.includes(value) ? list : [...list, value]
	return list.filter(entry => entry !== value)
}

export function CriteriaFieldset({
	criteria,
	publishers,
	onChange,
}: CriteriaFieldsetProps) {
	return (
		<div className="grid min-w-0 content-start gap-4">
			<fieldset className="grid min-w-0 gap-1.5">
				<legend className={FIELD_LABEL_CLASS}>Source</legend>
				<div className="grid grid-cols-1 gap-x-3 gap-y-1 min-[460px]:grid-cols-2">
					{SOURCE_CHOICES.map(choice => (
						<FilterChoice
							key={choice.value}
							type="checkbox"
							checked={criteria.sources.includes(choice.value)}
							onChange={event =>
								onChange({
									...criteria,
									sources: toggled<AppSourceKind>(
										criteria.sources,
										choice.value,
										event.target.checked,
									),
								})
							}
						>
							{choice.label}
						</FilterChoice>
					))}
				</div>
				<p className="text-xs text-(--text-muted)">{SOURCE_HINT}</p>
			</fieldset>
			<PublisherCriteria
				publishers={publishers}
				criteria={criteria}
				onChange={onChange}
			/>
			<FilterDisclosure
				title="Launch target"
				selectedCount={criteria.availability.length}
			>
				<div className="grid gap-1">
					{AVAILABILITY_CHOICES.map(choice => (
						<FilterChoice
							key={choice.value}
							type="checkbox"
							checked={criteria.availability.includes(
								choice.value,
							)}
							onChange={event =>
								onChange({
									...criteria,
									availability: toggled<AvailabilityBucket>(
										criteria.availability,
										choice.value,
										event.target.checked,
									),
								})
							}
						>
							{choice.label}
						</FilterChoice>
					))}
				</div>
			</FilterDisclosure>
			<fieldset className="grid min-w-0 gap-1.5">
				<legend className={FIELD_LABEL_CLASS}>
					Added to the catalog
				</legend>
				<div className="grid grid-cols-2 gap-x-3 gap-y-1 min-[460px]:grid-cols-3">
					{ADDED_WITHIN_OPTIONS.map(option => (
						<FilterChoice
							key={option.label}
							type="radio"
							name="added-within"
							checked={criteria.addedWithinDays === option.value}
							onChange={() =>
								onChange({
									...criteria,
									addedWithinDays: option.value,
								})
							}
						>
							{option.label}
						</FilterChoice>
					))}
				</div>
			</fieldset>
		</div>
	)
}

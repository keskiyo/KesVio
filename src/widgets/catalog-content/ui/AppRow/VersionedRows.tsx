import { Fragment, useState } from 'react'
import { CollapsiblePanel } from '../../../../shared/ui/CollapsiblePanel'
import { VersionToggle } from './RowAction'
import type { VersionedRowsProps } from './types'

export function VersionedRows({ groups, renderRow }: VersionedRowsProps) {
	const [expanded, setExpanded] = useState<string[]>([])
	const toggle = (id: string) =>
		setExpanded(open =>
			open.includes(id)
				? open.filter(entry => entry !== id)
				: [...open, id],
		)
	return groups.map(({ primary, older }) => {
		const open = expanded.includes(primary.id)
		return (
			<Fragment key={primary.id}>
				{renderRow(
					primary,
					older.length > 0 && (
						<VersionToggle
							appName={primary.name}
							olderCount={older.length}
							expanded={open}
							onToggle={() => toggle(primary.id)}
						/>
					),
				)}
				{older.map(app => (
					<CollapsiblePanel key={app.id} open={open}>
						{renderRow(app, null)}
					</CollapsiblePanel>
				))}
			</Fragment>
		)
	})
}

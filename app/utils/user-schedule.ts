import { z } from 'zod'

export const borderColor = ({
	first,
	crossover,
	last,
}: {
	first?: boolean | null
	crossover?: boolean | null
	last?: boolean | null
}) => {
	let output = ''
	// overwrite blue with green - prioritizing green
	if (crossover) output = 'rounded-bottom border-t-4 border-t-blue-900/70'
	if (first) output = 'border-t-4 border-t-green-900/70'
	// append bottom
	if (last) output += 'border-b-4 border-b-red-900/70'
	return output
}

export const backgroundColor = (charge: string) => {
	switch (charge) {
		case 'first':
			return 'bg-green-900/70 border-1 border-secondary-foreground font-semibold'
		case 'crossover':
			return 'bg-blue-900/70 border-1 border-secondary-foreground font-semibold'
		case 'last':
			return 'bg-red-900/70 border-1 border-secondary-foreground font-semibold'
		case 'normal':
			return 'bg-muted border-1 border-secondary-foreground/40'
		case 'none':
		default:
			return 'bg-muted-40'
	}
}

export const SearchResultsSchema = z.array(
	z.object({
		userId: z.string(),
		display: z.string(),
		portId: z.string(),
		ditch: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(9)),
		position: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(99)),
		entry: z.string(),
		section: z.string(),
		hours: z.preprocess(x => (x ? x : 0), z.coerce.number().multipleOf(0.5).min(0).max(36)),
		start: z.date().nullable(),
		stop: z.date().nullable(),
		first: z.boolean().optional().nullable(),
		crossover: z.boolean().optional().nullable(),
		last: z.boolean().optional().nullable(),
	}),
)

const found: FirstDitchType = {
	'1': { '10-01': { first: false, South: false, last: false } },
	'2': { '10-01': { first: false, South: false, last: false } },
	'3': { '10-01': { first: false, South: false, last: false } },
	'4': { '10-01': { first: false, South: false, last: false } },
	'5': { '10-03': { first: false, South: false, last: false } },
	'6': { '10-03': { first: false, South: false, last: false } },
	'7': { '10-03': { first: false, South: false, last: false } },
	'8': { '10-03': { first: false, South: false, last: false } },
	'9': {
		'10-01': { first: false, East: false, last: false },
		'10-03': { first: false, East: false, last: false },
	},
}

type FirstDitchType = {
	// ditch
	[key: string]: {
		// entry - for <td>
		[key: string]: {
			// section
			[key: string]: boolean
		}
	}
}

export type UserScheduleType = {
	userId: string
	portId: string
	display: string | null
	ditch: number
	position: number
	entry: string
	section: string
	hours: number | bigint | null
	start: Date | string | null
	stop: Date | string | null
	schedule?: string[]
	first?: boolean | null
	crossover?: boolean | null
	last?: boolean | null
}

export const assignChargesToSchedules = (schedules: UserScheduleType[]) => {
	const updated = schedules.map(schedule => {
		const { ditch, entry, section, hours } = schedule
		if (hours) {
			if (found[ditch][entry].first === false) {
				found[ditch][entry].first = true
				schedule.first = true
			}

			if (found[ditch][entry][section] === false) {
				found[ditch][entry][section] = true
				schedule.crossover = true
			}
		}
		return schedule
	})

	return updated.reverse().map(schedule => {
		const { hours, ditch, entry } = schedule
		if (hours) {
			if (found[ditch][entry].last === false) {
				found[ditch][entry].last = true
				schedule.last = true
			}
		}
		return schedule
	})
}

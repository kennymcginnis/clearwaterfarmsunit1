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
	if (crossover) output = 'rounded-bottom border-t-4 border-t-blue-900/70 '
	if (first) output = 'border-t-4 border-t-green-900/70 '
	// append bottom
	if (last) output += 'border-b-4 border-b-red-900/70 '
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
			return 'bg-muted/40'
	}
}

export const SearchResultsSchema = z.array(
	z.object({
		userId: z.string(),
		quickbooks: z.string().optional(),
		display: z.string(),
		portId: z.string(),
		ditch: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(9)),
		position: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(99)),
		entry: z.string(),
		address: z.number().nullable(),
		section: z.string(),
		hours: z.preprocess(x => (x ? x : 0), z.coerce.number().multipleOf(0.5).min(0).max(36)),
		start: z.date().nullable(),
		stop: z.date().nullable(),
		first: z.boolean().optional().nullable(),
		crossover: z.boolean().optional().nullable(),
		last: z.boolean().optional().nullable(),
	}),
)
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
	address: number | null
	hours: number | bigint | null
	start: Date | string | null
	stop: Date | string | null
	schedule?: string[]
	first?: boolean | null
	crossover?: boolean | null
	last?: boolean | null
}

export const assignChargesToSchedules = (schedules: UserScheduleType[]) => {
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

const last = 'Please do not pull your checks after irrigation.'
export const crossovers: {
	[key: string]: { [key: string]: { [key: string]: string } }
} = {
	'1': {
		'10-01': {
			first: 'Ditch 9 to Ditch 1 (Open Ditch 1, then Close Ditch 9)',
			crossover: 'Crossover @ Ditch 1 and Orangewood',
			last,
		},
	},
	'2': {
		'10-01': {
			first: 'Ditch 1 to Ditch 2 (Open Ditch 2, then Close Ditch 1)',
			crossover: 'Crossover @ Ditch 2 and Orangewood',
			last,
		},
	},
	'3': {
		'10-01': {
			first: 'Ditch 2 to Ditch 3 (Open Ditch 3, then Close Ditch 2)',
			crossover: 'Crossover @ Ditch 3 and Orangewood',
			last,
		},
	},
	'4': {
		'10-01': {
			first: 'Ditch 3 to Ditch 4 (Open Ditch 4, then Close Ditch 3)',
			crossover: 'Crossover @ Ditch 4 and Orangewood',
			last,
		},
	},
	'5': {
		'10-03': {
			first: 'Ditch 9 to Ditch 5 (Open Ditch 5, then Close Ditch 9)',
			crossover: 'Crossover @ Ditch 5 and Orangewood',
			last,
		},
	},
	'6': {
		'10-03': {
			first: 'Ditch 5 to Ditch 6 (Open Ditch 6, then Close Ditch 5)',
			crossover: 'Crossover @ Ditch 6 and Orangewood',
			last,
		},
	},
	'7': {
		'10-03': {
			first: 'Ditch 6 at Ditch 7 (Open Ditch 7, then Close Ditch 6)',
			crossover: 'Crossover @ Ditch 7 and Orangewood',
			last,
		},
	},
	'8': {
		'10-03': {
			first: 'Ditch 7 to Ditch 8 (Open Ditch 8, then Close Ditch 7)',
			crossover: 'Crossover @ Ditch 8 and Orangewood',
			last,
		},
	},
	'9': {
		'10-01': {
			first: '10-01 starts (Open Ditch 9, then Close Ditch 4)',
			crossover: 'Crossover @ Ditch 9 and 185th',
			last,
		},
		'10-03': {
			first: '10-03 starts (Open Ditch 9, then Close Ditch 8)',
			crossover: 'Crossover @ Ditch 9 and 181st',
			last,
		},
	},
}

export const crossover: {
	[key: string]: { [key: string]: { [key: string]: { first: boolean; description: string } } }
} = {
	'1': {
		'10-01': {
			North: {
				first: false,
				description: 'Ditch 9 to Ditch 1 (Open Ditch 1, then Close Ditch 9)',
			},
			South: { first: false, description: 'Crossover @ Ditch 1 and Orangewood' },
		},
	},
	'2': {
		'10-01': {
			North: {
				first: false,
				description: 'Ditch 1 to Ditch 2 (Open Ditch 2, then Close Ditch 1)',
			},
			South: { first: false, description: 'Crossover @ Ditch 2 and Orangewood' },
		},
	},
	'3': {
		'10-01': {
			North: {
				first: false,
				description: 'Ditch 2 to Ditch 3 (Open Ditch 3, then Close Ditch 2)',
			},
			South: { first: false, description: 'Crossover @ Ditch 3 and Orangewood' },
		},
	},
	'4': {
		'10-01': {
			North: {
				first: false,
				description: 'Ditch 3 to Ditch 4 (Open Ditch 4, then Close Ditch 3)',
			},
			South: { first: false, description: 'Crossover @ Ditch 4 and Orangewood' },
		},
	},
	'5': {
		'10-03': {
			North: {
				first: false,
				description: 'Ditch 9 to Ditch 5 (Open Ditch 5, then Close Ditch 9)',
			},
			South: { first: false, description: 'Crossover @ Ditch 5 and Orangewood' },
		},
	},
	'6': {
		'10-03': {
			North: {
				first: false,
				description: 'Ditch 5 to Ditch 6 (Open Ditch 6, then Close Ditch 5)',
			},
			South: { first: false, description: 'Crossover @ Ditch 6 and Orangewood' },
		},
	},
	'7': {
		'10-03': {
			North: {
				first: false,
				description: 'Ditch 6 at Ditch 7 (Open Ditch 7, then Close Ditch 6)',
			},
			South: { first: false, description: 'Crossover @ Ditch 7 and Orangewood' },
		},
	},
	'8': {
		'10-03': {
			North: {
				first: false,
				description: 'Ditch 7 to Ditch 8 (Open Ditch 8, then Close Ditch 7)',
			},
			South: { first: false, description: 'Crossover @ Ditch 8 and Orangewood' },
		},
	},
	'9': {
		'10-01': {
			West: {
				first: false,
				description: '10-01 starts (Open Ditch 9, then Close Ditch 4)',
			},
			East: { first: false, description: 'Crossover @ Ditch 9 and 185th' },
		},
		'10-03': {
			West: {
				first: false,
				description: '10-03 starts (Open Ditch 9, then Close Ditch 8)',
			},
			East: { first: false, description: 'Crossover @ Ditch 9 and 181st' },
		},
	},
}

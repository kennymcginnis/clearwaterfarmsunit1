import { Readable } from 'node:stream'
import { json, redirect, createReadableStreamFromReadable, type LoaderFunctionArgs } from '@remix-run/node'
import { format } from 'date-fns'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'

const CrossoversSchema = z
	.object({
		userId: z.string(),
		member: z.string(),
		ditch: z.number(),
		position: z.number(),
		entry: z.string(),
		section: z.string(),
		start: z.date().nullable(),
	})
	.array()

export async function loader({ params }: LoaderFunctionArgs) {
	if (!params?.date) return redirect('/schedules')

	const rawUsers = await prisma.$queryRaw`
		SELECT User.id AS userId, User.member, 
					 Port.ditch, Port.position, Port.entry, Port.section, 
					 mid.start
		  FROM User
		 INNER JOIN Port ON User.id = Port.userId
     INNER JOIN (
      SELECT UserSchedule.userId, UserSchedule.portId, UserSchedule.start
        FROM Schedule 
       INNER JOIN UserSchedule ON Schedule.id = UserSchedule.scheduleId
       WHERE Schedule.date = ${params.date}
			   AND UserSchedule.hours > 0
         ) mid
		    ON User.id = mid.userId
		   AND Port.id = mid.portId
		 WHERE User.active
		 ORDER BY mid.start
	`

	const result = CrossoversSchema.safeParse(rawUsers)
	if (!result.success) return json({ status: 'error', error: result.error.message }, { status: 400 })

	type DitchSectionType = {
		[key: string]: { [key: string]: { [key: string]: { first: boolean; description: string } } }
	}
	const crossover: DitchSectionType = {
		'1': {
			'10-01': {
				North: { first: false, description: 'Ditch 9 to Ditch 1 (will need to Open Ditch 1, then Close Ditch 9)' },
				South: { first: false, description: 'Crossover @ Ditch 1 and Orangewood' },
			},
		},
		'2': {
			'10-01': {
				North: { first: false, description: 'Ditch 1 to Ditch 2 (will need to Open Ditch 2, then Close Ditch 1)' },
				South: { first: false, description: 'Crossover @ Ditch 2 and Orangewood' },
			},
		},
		'3': {
			'10-01': {
				North: { first: false, description: 'Ditch 2 to Ditch 3 (will need to Open Ditch 3, then Close Ditch 2)' },
				South: { first: false, description: 'Crossover @ Ditch 3 and Orangewood' },
			},
		},
		'4': {
			'10-01': {
				North: { first: false, description: 'Ditch 3 to Ditch 4 (will need to Open Ditch 4, then Close Ditch 3)' },
				South: { first: false, description: 'Crossover @ Ditch 4 and Orangewood' },
			},
		},
		'5': {
			'10-03': {
				North: { first: false, description: 'Ditch 9 to Ditch 5 (will need to Open Ditch 5, then Close Ditch 9)' },
				South: { first: false, description: 'Crossover @ Ditch 5 and Orangewood' },
			},
		},
		'6': {
			'10-03': {
				North: { first: false, description: 'Ditch 5 to Ditch 6 (will need to Open Ditch 6, then Close Ditch 5)' },
				South: { first: false, description: 'Crossover @ Ditch 6 and Orangewood' },
			},
		},
		'7': {
			'10-03': {
				North: { first: false, description: 'Ditch 6 at Ditch 7 (will need to Open Ditch 7, then Close Ditch 6)' },
				South: { first: false, description: 'Crossover @ Ditch 7 and Orangewood' },
			},
		},
		'8': {
			'10-03': {
				North: { first: false, description: 'Ditch 7 to Ditch 8 (will need to Open Ditch 8, then Close Ditch 7)' },
				South: { first: false, description: 'Crossover @ Ditch 8 and Orangewood' },
			},
		},
		'9': {
			'10-01': {
				West: {
					first: false,
					description: '10-01 starts (Ditch 9 starts) (Will need to go to Ditch 4/9 intersection and Open 9, Close 4)',
				},
				East: { first: false, description: 'Crossover @ Ditch 9 and 185th' },
			},
			'10-03': {
				West: {
					first: false,
					description: '10-03 starts (Ditch 9 starts) (Will need to go to Ditch 8/9 intersection and Open 9, Close 8)',
				},
				East: { first: false, description: 'Crossover @ Ditch 9 and 181st' },
			},
		},
	}
	const crossovers = []
	for (const { member, ditch, entry, section, start } of result.data) {
		if (!start) continue
		if (crossover[ditch][entry][section].first) continue
		crossover[ditch][entry][section].first = true
		const { description } = crossover[ditch][entry][section]
		crossovers.push({ ditch, entry, section, member, description, start })
	}

	const file = createReadableStreamFromReadable(
		Readable.from(
			[
				['ditch', 'entry', 'section', 'member', 'description', 'start'].join(','),
				...crossovers.map(({ ditch, entry, section, member, description, start }) =>
					[
						ditch,
						`"${entry}"`,
						section,
						`"${member}"`,
						`"${description}"`,
						`"${format(start, 'eee, MMM dd, h:mmaaa')}"`,
					].join(','),
				),
			].join('\n'),
		),
	)

	return new Response(file, {
		headers: {
			'Content-Disposition': `attachment; filename="crossovers-${params.date}.csv"`,
			'Content-Type': 'application/csv',
		},
	})
}

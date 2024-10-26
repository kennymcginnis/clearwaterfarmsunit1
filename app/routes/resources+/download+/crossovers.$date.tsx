import { Readable } from 'node:stream'
import { json, redirect, createReadableStreamFromReadable, type LoaderFunctionArgs } from '@remix-run/node'
import { format } from 'date-fns'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'
import { crossover } from '#app/utils/user-schedule.ts'

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

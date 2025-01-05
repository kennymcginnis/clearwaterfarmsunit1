import { Readable } from 'node:stream'
import { invariantResponse } from '@epic-web/invariant'
import { json, createReadableStreamFromReadable, type LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'
import { SearchResultsSchema } from '#app/utils/user-schedule.ts'

export async function loader({ params }: LoaderFunctionArgs) {
	invariantResponse(params.date, 'Date parameter Not found', { status: 404 })

	const schedule = await prisma.schedule.findFirst({ select: { id: true, state: true }, where: { date: params.date } })
	invariantResponse(schedule?.id, 'Schedule Not found', { status: 404 })

	const rawUsers = await prisma.$queryRaw`
		SELECT User.id AS userId, User.display, 
           Port.id AS portId, Port.ditch, Port.position, Port.entry, Port.section, Port.address, 
					 UserSchedule.hours, UserSchedule.start, UserSchedule.stop,
					 UserSchedule.first, UserSchedule.crossover, UserSchedule.last
		  FROM User
		 INNER JOIN Port ON User.id = Port.userId
		  LEFT JOIN UserSchedule
		    ON User.id = UserSchedule.userId
		   AND Port.id = UserSchedule.portId
		   AND UserSchedule.scheduleId = ${schedule.id}
		 WHERE User.active
		 ORDER BY Port.ditch, Port.position
	`

	const result = SearchResultsSchema.safeParse(rawUsers)
	if (!result.success) {
		return json({ status: 'error', error: result.error.message } as const, {
			status: 400,
		})
	}

	const file = createReadableStreamFromReadable(
		Readable.from(
			[
				[
					'userId',
					'display',
					'portId',
					'ditch',
					'address',
					'entry',
					'section',
					'hours',
					'start',
					'stop',
					'first',
					'crossover',
					'last',
				].join(','),
				...result.data.map(
					({ userId, display, portId, ditch, address, entry, section, hours, start, stop, first, crossover, last }) =>
						[
							userId,
							`"${display}"`,
							portId,
							ditch,
							address,
							entry,
							section,
							hours,
							start?.toISOString(),
							stop?.toISOString(),
							first ? 'First' : '',
							crossover ? 'Crossover' : '',
							last ? 'Last' : '',
						].join(','),
				),
			].join('\n'),
		),
	)

	return new Response(file, {
		headers: {
			'Content-Disposition': `attachment; filename="timeline-${params.date}.csv"`,
			'Content-Type': 'application/csv',
		},
	})
}

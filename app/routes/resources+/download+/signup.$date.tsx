import { Readable } from 'node:stream'
import { invariantResponse } from '@epic-web/invariant'
import { json, createReadableStreamFromReadable, type LoaderFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'

const UserSearchResultSchema = z.object({
	userId: z.string(),
	display: z.string(),
	portId: z.string(),
	ditch: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(9)),
	position: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(99)),
	entry: z.string(),
	section: z.string(),
	hours: z.bigint().or(z.number()).nullable(),
})

const UserSearchResultsSchema = z.array(UserSearchResultSchema)

export async function loader({ params }: LoaderFunctionArgs) {
	invariantResponse(params.date, 'Date parameter Not found', { status: 404 })

	const schedule = await prisma.schedule.findFirst({ select: { id: true, state: true }, where: { date: params.date } })
	invariantResponse(schedule?.id, 'Schedule Not found', { status: 404 })

	const rawUsers = await prisma.$queryRaw`
		SELECT User.id AS userId, User.display, 
           Port.id AS portId, Port.ditch, Port.position, Port.entry, Port.section, 
           UserSchedule.hours
		  FROM User
		 INNER JOIN Port ON User.id = Port.userId
		  LEFT JOIN UserSchedule
		    ON User.id = UserSchedule.userId
		   AND Port.id = UserSchedule.portId
		   AND UserSchedule.scheduleId = ${schedule.id}
		 WHERE User.active
		 ORDER BY Port.ditch, Port.position
	`

	const result = UserSearchResultsSchema.safeParse(rawUsers)
	if (!result.success) {
		return json({ status: 'error', error: result.error.message } as const, {
			status: 400,
		})
	}

	const file = createReadableStreamFromReadable(
		Readable.from(
			[
				['userId', 'display', 'portId', 'ditch', 'position', 'entry', 'section', 'hours'].join(','),
				...result.data.map(({ userId, display, portId, ditch, position, entry, section, hours }) =>
					[userId, `"${display}"`, portId, ditch, position, entry, section, hours].join(','),
				),
			].join('\n'),
		),
	)

	return new Response(file, {
		headers: {
			'Content-Disposition': `attachment; filename="signup-${params.date}.csv"`,
			'Content-Type': 'application/csv',
		},
	})
}

import { Readable } from 'node:stream'
import { json, redirect, createReadableStreamFromReadable, type LoaderFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'

const UserSearchResultSchema = z.object({
	id: z.string(),
	display: z.string(),
	ditch: z.number(),
	position: z.number(),
	hours: z.bigint().or(z.number()).nullable(),
})

const UserSearchResultsSchema = z.array(UserSearchResultSchema)

export async function loader({ params }: LoaderFunctionArgs) {
	if (!params?.date) return redirect('/schedules')

	const rawUsers = await prisma.$queryRaw`
		SELECT User.id, User.display, Port.ditch, Port.position, UserSchedule.hours
		  FROM User
		 INNER JOIN Port ON User.id = Port.userId
      LEFT JOIN (
				SELECT UserSchedule.userId, UserSchedule.portId, UserSchedule.hours
				  FROM Schedule 
				 INNER JOIN UserSchedule ON Schedule.id = UserSchedule.scheduleId
				 WHERE Schedule.date = ${params.date}
			) UserSchedule
		    ON User.id = UserSchedule.userId
		   AND Port.id = UserSchedule.portId
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
				['id', 'display', 'ditch', 'position', 'hours'].join(','),
				...result.data.map(({ id, display, ditch, position, hours }) =>
					[id, `"${display}"`, ditch, position, hours].join(','),
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

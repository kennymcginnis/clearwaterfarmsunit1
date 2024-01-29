import { Readable } from 'node:stream'
import { json, redirect, createReadableStreamFromReadable, type LoaderFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'

const UserSearchResultSchema = z.object({
	id: z.string(),
	username: z.string(),
	ditch: z.number(),
	position: z.number(),
	hours: z.bigint().or(z.number()).nullable(),
})

const UserSearchResultsSchema = z.array(UserSearchResultSchema)

export async function loader({ params }: LoaderFunctionArgs) {
	if (!params?.date) {
		return redirect('/schedules')
	}

	const rawUsers = await prisma.$queryRaw`
		SELECT User.id, User.username, Port.ditch, Port.position, UserSchedule.hours, UserSchedule.head
		FROM User
		INNER JOIN Port ON User.id = Port.userId
    LEFT JOIN (
      SELECT UserSchedule.userId, UserSchedule.ditch, UserSchedule.hours, UserSchedule.head
      FROM Schedule 
      INNER JOIN UserSchedule ON Schedule.id = UserSchedule.scheduleId
      WHERE Schedule.date = ${params.date}
    ) UserSchedule
		ON User.id = UserSchedule.userId
		AND Port.ditch = UserSchedule.ditch
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
				['id', 'username', 'ditch', 'position', 'hours'].join(','),
				...result.data.map(raw => [raw.id, raw.username, raw.ditch, raw.position, raw.hours].join(',')),
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

/* eslint-disable no-sparse-arrays */
import { Readable } from 'node:stream'
import { json, redirect, createReadableStreamFromReadable, type LoaderFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'
import { formatPrintableDates, formatHours } from '#app/utils/misc'

const UserSearchResultSchema = z.object({
	id: z.string(),
	display: z.string(),
	ditch: z.number(),
	position: z.number(),
	hours: z.bigint().or(z.number()).nullable(),
	start: z.date().nullable(),
	stop: z.date().nullable(),
})

const UserSearchResultsSchema = z.array(UserSearchResultSchema)

export async function loader({ params }: LoaderFunctionArgs) {
	if (!params?.date) return redirect('/schedules')

	const rawUsers = await prisma.$queryRaw`
		SELECT User.id, User.display, Port.ditch, Port.position, UserSchedule.hours, UserSchedule.start, UserSchedule.stop
		FROM User
		INNER JOIN Port ON User.id = Port.userId
    LEFT JOIN (
      SELECT UserSchedule.userId, UserSchedule.ditch, UserSchedule.hours, UserSchedule.start, UserSchedule.stop
      FROM Schedule 
      INNER JOIN UserSchedule ON Schedule.id = UserSchedule.scheduleId
      WHERE Schedule.date = ${params.date}
    ) UserSchedule
		ON User.id = UserSchedule.userId
		AND Port.ditch = UserSchedule.ditch
		WHERE User.active
		ORDER BY Port.ditch, Port.position
	`

	const result = UserSearchResultsSchema.safeParse(rawUsers)
	if (!result.success) {
		return json({ status: 'error', error: result.error.message } as const, {
			status: 400,
		})
	}

	const page = (ditch: number): number => Math.ceil(ditch / 2)

	type PositionDitchType = {
		// page - for <table>
		[key: string]: {
			// position - for <tr>
			[key: string]: {
				// ditch - for <td>
				[key: string]: UserType
			}
		}
	}
	type UserType = {
		id: string
		display: string
		ditch: number
		position: number
		hours: number | bigint | null
		start: Date | string | null
		stop: Date | string | null
		schedule: string
	}
	const users: PositionDitchType = {}
	for (let user of result.data) {
		const { start, stop, ditch, position } = user
		const pageNumber = page(ditch)
		const leftOrRight = ditch % 2 ? 'left' : 'right'
		const userType = { ...user, schedule: formatPrintableDates({ start, stop }) }
		if (!users[pageNumber]) users[pageNumber] = { [position]: { [leftOrRight]: userType } }
		if (!users[pageNumber][position]) users[pageNumber][position] = { [leftOrRight]: userType }
		else users[pageNumber][position][leftOrRight] = userType
	}

	const a = '',
		b = '',
		c = '',
		d = '',
		e = '',
		f = '',
		g = ''

	const output: string[][] = []
	for (const [pageNumber, page] of Object.entries(users)) {
		output.push([
			`Ditch ${Number(pageNumber) * 2 - 1}`,
			b,
			c,
			d,
			Number(pageNumber) < 5 ? `Ditch ${Number(pageNumber) * 2}` : e,
			f,
			g,
		])
		for (const { left, right } of Object.values(page)) {
			let row: string[] = []
			if (left) row.push(`"${left.display}"`, formatHours(Number(left.hours)), left.schedule, d)
			else row.push(a, b, c, d)
			if (right) row.push(`"${right.display}"`, formatHours(Number(right.hours)), right.schedule)
			else row.push(e, f, g)
			output.push(row)
		}
		output.push([a, b, c, d, e, f, g])
	}
	const file = createReadableStreamFromReadable(Readable.from([...output.map(row => row.join(','))].join('\n')))
	return new Response(file, {
		headers: {
			'Content-Disposition': `attachment; filename="timeline-${params.date}.csv"`,
			'Content-Type': 'application/csv',
		},
	})
}

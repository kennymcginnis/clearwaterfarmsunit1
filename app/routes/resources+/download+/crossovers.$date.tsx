import { Readable } from 'node:stream'
import { json, redirect, createReadableStreamFromReadable, type LoaderFunctionArgs } from '@remix-run/node'
import { format } from 'date-fns'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'

const CrossoversSchema = z
	.object({
		ditch: z.number(),
		position: z.number(),
		section: z.string(),
		start: z.date().nullable(),
	})
	.array()

export async function loader({ params }: LoaderFunctionArgs) {
	if (!params?.date) return redirect('/schedules')

	const rawUsers = await prisma.$queryRaw`
		SELECT Port.ditch, Port.position, Port.section, mid.start
		FROM User
		INNER JOIN Port ON User.id = Port.userId
    INNER JOIN (
      SELECT UserSchedule.userId, UserSchedule.ditch, UserSchedule.start
      FROM Schedule 
      INNER JOIN UserSchedule ON Schedule.id = UserSchedule.scheduleId
      WHERE Schedule.date = ${params.date}
			AND UserSchedule.hours > 0
    ) mid
		ON User.id = mid.userId
		AND Port.ditch = mid.ditch
		WHERE User.active
		ORDER BY Port.ditch, Port.position
	`

	const result = CrossoversSchema.safeParse(rawUsers)
	if (!result.success) return json({ status: 'error', error: result.error.message }, { status: 400 })

	type DitchSectionType = { [key: string]: { [key: string]: boolean } }

	const crossover: DitchSectionType = {}
	const crossovers = []
	for (const { ditch, section, start } of result.data) {
		if (!start) continue
		if (crossover[ditch]) {
			if (crossover[ditch][section]) continue
			crossover[ditch][section] = true
		} else {
			crossover[ditch] = { [section]: true }
		}
		crossovers.push({ ditch, section, start })
	}

	const file = createReadableStreamFromReadable(
		Readable.from(
			[
				['ditch', 'section', 'start'].join(','),
				...crossovers
					.sort((a, b) => Number(a.start) - Number(b.start))
					.map(({ ditch, section, start }) => [ditch, section, `"${format(start, 'eee, MMM dd, h:mmaaa')}"`].join(',')),
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

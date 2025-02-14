import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs } from '@remix-run/node'
import { subMinutes } from 'date-fns'
import { prisma } from '#app/utils/db.server.ts'
import { generatePublicId } from '#app/utils/public-id.ts'
import { assignDutiesToSchedules, SearchResultsSchema, type UserScheduleType } from '#app/utils/user-schedule.ts'

export const action = async ({ params }: ActionFunctionArgs) => {
	const schedule = await prisma.schedule.findFirst({
		select: { id: true, state: true },
		where: { date: params.date },
	})
	invariantResponse(schedule?.id, 'Schedule Not found', { status: 404 })
	switch (params.intent) {
		case 'crossover': {
			const userSchedules = await prisma.userSchedule.findMany({
				select: {
					port: { select: { ditch: true, entry: true } },
					userId: true,
					first: true,
					crossover: true,

					acknowledgeFirst: true,
					acknowledgeCrossover: true,
					volunteerFirst: true,
					volunteerCrossover: true,
					requestsTraining: true,

					hours: true,
					start: true,
					stop: true,
				},
				where: { scheduleId: schedule.id, OR: [{ first: true }, { crossover: true }] },
			})

			type CrossoverCreateManyInput = {
				ditch: number
				entry: string
				duty: string
				dutyStart?: Date | null

				acknowledged?: boolean | null
				requestsTraining?: boolean | null

				userId?: string | null
				volunteerId?: string | null

				hours?: number
				start?: Date | string | null
				stop?: Date | string | null
			}
			const crossoversFound: { [key: string]: CrossoverCreateManyInput } = {
				'9.10-01.first': { ditch: 9, entry: '10-01', duty: 'first' },
				'9.10-01.crossover': { ditch: 9, entry: '10-01', duty: 'crossover' },
				'1.10-01.first': { ditch: 1, entry: '10-01', duty: 'first' },
				'1.10-01.crossover': { ditch: 1, entry: '10-01', duty: 'crossover' },
				'2.10-01.first': { ditch: 2, entry: '10-01', duty: 'first' },
				'2.10-01.crossover': { ditch: 2, entry: '10-01', duty: 'crossover' },
				'3.10-01.first': { ditch: 3, entry: '10-01', duty: 'first' },
				'3.10-01.crossover': { ditch: 3, entry: '10-01', duty: 'crossover' },
				'4.10-01.first': { ditch: 4, entry: '10-01', duty: 'first' },
				'4.10-01.crossover': { ditch: 4, entry: '10-01', duty: 'crossover' },
				'9.10-03.first': { ditch: 9, entry: '10-03', duty: 'first' },
				'9.10-03.crossover': { ditch: 9, entry: '10-03', duty: 'crossover' },
				'5.10-03.first': { ditch: 5, entry: '10-03', duty: 'first' },
				'5.10-03.crossover': { ditch: 5, entry: '10-03', duty: 'crossover' },
				'6.10-03.first': { ditch: 6, entry: '10-03', duty: 'first' },
				'6.10-03.crossover': { ditch: 6, entry: '10-03', duty: 'crossover' },
				'7.10-03.first': { ditch: 7, entry: '10-03', duty: 'first' },
				'7.10-03.crossover': { ditch: 7, entry: '10-03', duty: 'crossover' },
				'8.10-03.first': { ditch: 8, entry: '10-03', duty: 'first' },
				'8.10-03.crossover': { ditch: 8, entry: '10-03', duty: 'crossover' },
			}

			userSchedules.forEach(
				({
					port: { ditch, entry },
					first,
					crossover,
					userId,
					hours,
					start,
					stop,
					acknowledgeFirst,
					acknowledgeCrossover,
					volunteerFirst,
					volunteerCrossover,
					requestsTraining,
				}) => {
					if (first && start) {
						const original = crossoversFound[`${ditch}.${entry}.first`]
						crossoversFound[`${ditch}.${entry}.first`] = {
							...original,
							userId,
							hours,
							start,
							stop,
							duty: 'first',
							dutyStart: subMinutes(start, 15),
							acknowledged: acknowledgeFirst,
							volunteerId: volunteerFirst,
							requestsTraining,
						}
					}
					if (crossover && start) {
						const original = crossoversFound[`${ditch}.${entry}.crossover`]
						crossoversFound[`${ditch}.${entry}.crossover`] = {
							...original,
							userId,
							hours,
							start,
							stop,
							duty: 'crossover',
							dutyStart: subMinutes(start, 5),
							acknowledged: acknowledgeCrossover,
							volunteerId: volunteerCrossover,
							requestsTraining,
						}
					}
				},
			)

			await prisma.crossover.deleteMany({ where: { scheduleId: schedule.id } })
			const data = Object.values(crossoversFound)
				.sort((a, b) => (a.start && b.start ? new Date(a.start).getTime() - new Date(b.start).getTime() : 0))
				.map((crossover, index) => ({
					id: generatePublicId(),
					order: index + 1,
					scheduleId: schedule.id,
					...crossover,
				}))
			await prisma.crossover.createMany({ data })
			return data
		}
		case 'format': {
			const rawUsers = await prisma.$queryRaw`
				SELECT User.id AS userId, User.display, 
							 Port.id AS portId, Port.ditch, Port.position, Port.entry, Port.section, 
							 UserSchedule.hours, UserSchedule.start, UserSchedule.stop
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
			if (!result.success) return null

			let count = 0
			const updated: UserScheduleType[] = assignDutiesToSchedules(result.data)
			for (let { userId, portId, first, crossover, last } of updated) {
				if (first || crossover || last) {
					await prisma.userSchedule.update({
						data: { first, crossover, last },
						where: { userId_scheduleId_portId: { userId, scheduleId: schedule.id, portId } },
					})
					count += 1
				}
			}
			return `Complete. ${count} updated.`
		}
		default:
			invariantResponse(params.intent, `Intent not handled.`, { status: 404 })
			break
	}
}

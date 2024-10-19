import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'
import { assignChargesToSchedules, SearchResultsSchema, type UserScheduleType } from '#app/utils/user-schedule.ts'

export const action = async ({ params }: ActionFunctionArgs) => {
	switch (params.intent) {
		case 'format': {
			const schedule = await prisma.schedule.findFirst({
				select: { id: true, state: true },
				where: { date: params.date },
			})
			invariantResponse(schedule?.id, 'Schedule Not found', { status: 404 })

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
			const updated: UserScheduleType[] = assignChargesToSchedules(result.data)
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

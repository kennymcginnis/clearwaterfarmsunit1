import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'
import { generatePublicId } from '#app/utils/public-id'

export const action = async ({ params }: ActionFunctionArgs) => {
	switch (params.intent) {
		case 'assign-ids': {
			const userSchedules = await prisma.userSchedule.findMany({ where: { id: null } })
			userSchedules.map(async ({ userId, ditch, scheduleId }) => {
				const id = generatePublicId()
				const found = await prisma.userSchedule.findFirst({ where: { id } })
				if (!found) {
					await prisma.userSchedule.update({
						data: { id },
						where: { userId_ditch_scheduleId: { userId, ditch, scheduleId } },
					})
				}
			})

			return `Complete. ${userSchedules.length} updated.`
		}
		default:
			invariantResponse(params.intent, `Intent not handled.`, { status: 404 })
			break
	}
}

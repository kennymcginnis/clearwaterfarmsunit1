import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'

export async function loader() {
	return await prisma.port.findMany()
}

const eastOrWest = (position: number) => {
	if (position < 8) return 'West'
	if (position < 15) return 'East'
	if (position < 20) return 'West'
	return 'East'
}
const leftOrRight = (ditch: number, section: string | null) => {
	if (ditch < 5) return 'left'
	if (ditch < 9) return 'right'
	return section === 'West' ? 'left' : 'right'
}

export const action = async ({ params }: ActionFunctionArgs) => {
	switch (params.intent) {
		case 'entry': {
			const ports = await prisma.port.findMany()
			for (const { id, ditch, section, position } of ports) {
				await prisma.port.update({
					data: {
						entry: leftOrRight(ditch, section) === 'left' ? '10-01' : '10-03',
						section: ditch === 9 ? eastOrWest(position) : section,
					},
					where: { id },
				})
			}
			return `Complete.`
		}
		case 'userSchedules': {
			const ports = await prisma.port.findMany()
			await prisma.userSchedule.deleteMany({ where: { hours: 0 } })
			let updated = 0
			const userSchedules = await prisma.userSchedule.findMany({ where: { portId: null } })
			for (let { userId, ditch, scheduleId } of userSchedules) {
				const port = ports.find(p => p.userId === userId && p.ditch === ditch)
				if (port) {
					await prisma.userSchedule.update({
						data: { portId: port.id },
						where: { userId_ditch_scheduleId: { userId, ditch, scheduleId } },
					})
					updated++
				}
			}
			return `Complete. ${updated} updated.`
		}
		default:
			invariantResponse(params.intent, `Intent not handled.`, { status: 404 })
			break
	}
}

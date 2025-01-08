import { type LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'

export async function loader({ request, params }: LoaderFunctionArgs) {
	const queryParams = new URL(request.url).searchParams
	const userId = queryParams.get('userId')
	const scheduleId = queryParams.get('scheduleId')
	const portId = queryParams.get('portId')

	if (!userId || !scheduleId || !portId) return new Response('Missing parameters', { status: 400 })

	const { acknowledge, type } = params
	const acknowledged = acknowledge === 'acknowledge'

	switch (type) {
		case 'first':
			return await prisma.userSchedule.update({
				data: { acknowledgeFirst: acknowledged },
				where: { userId_scheduleId_portId: { userId, scheduleId, portId } },
			})
		case 'crossover':
			return await prisma.userSchedule.update({
				data: { acknowledgeCrossover: acknowledged },
				where: { userId_scheduleId_portId: { userId, scheduleId, portId } },
			})
	}
}

import { type LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'

export async function loader({ request, params }: LoaderFunctionArgs) {
	const queryParams = new URL(request.url).searchParams
	const userId = queryParams.get('userId')
	const scheduleId = queryParams.get('scheduleId')
	const portId = queryParams.get('portId')

	if (!userId || !scheduleId || !portId) return new Response('Missing parameters', { status: 400 })

	const { acknowledge, type } = params
	const acknowledged = acknowledge === 'acknowledge'

	const schedule = await prisma.schedule.findFirstOrThrow({
		select: { date: true },
		where: { id: scheduleId },
	})

	switch (type) {
		case 'first':
			await prisma.userSchedule.update({
				data: { acknowledgeFirst: acknowledged },
				where: { userId_scheduleId_portId: { userId, scheduleId, portId } },
			})
			break
		case 'crossover':
			await prisma.userSchedule.update({
				data: { acknowledgeCrossover: acknowledged },
				where: { userId_scheduleId_portId: { userId, scheduleId, portId } },
			})
			break
		default:
			return new Response('Invalid type, expected `first` or `crossover`', { status: 400 })
	}

	return redirectWithToast(`/schedule/${schedule.date}/crossovers`, {
		type: 'success',
		title: 'Success',
		description: `${acknowledge ? 'Acknowledged ' : 'Request for assistance submitted for '} ${type === 'first' ? 'gate change.' : 'crossover.'}.`,
	})
}

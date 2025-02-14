import { type LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'

export async function loader({ request, params }: LoaderFunctionArgs) {
	const queryParams = new URL(request.url).searchParams
	const crossoverId = queryParams.get('crossoverId')
	if (!crossoverId) return new Response('Missing parameters', { status: 400 })

	const { acknowledge } = params
	const acknowledged = acknowledge === 'acknowledge'
	const requestsTraining = Boolean(queryParams.get('requestsTraining')) ?? false

	const { duty, schedule } = await prisma.crossover.findFirstOrThrow({
		select: { duty: true, schedule: { select: { date: true } } },
		where: { id: crossoverId },
	})

	await prisma.crossover.update({
		data: { acknowledged, requestsTraining },
		where: { id: crossoverId },
	})

	return redirectWithToast(`/schedule/${schedule.date}/crossovers`, {
		type: 'success',
		title: 'Success',
		description: `${acknowledge ? 'Acknowledged ' : 'Request for assistance submitted for '} ${duty === 'first' ? 'gate change.' : 'crossover.'}.`,
	})
}

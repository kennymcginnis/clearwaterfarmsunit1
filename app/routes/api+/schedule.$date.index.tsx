import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'

const select = {
	id: true,
	date: true,
	deadline: true,
	source: true,
	costPerHour: true,
	state: true,
	start: true,
	stop: true,
}

export async function loader({ params }: LoaderFunctionArgs) {
	return await prisma.schedule.findFirstOrThrow({
		select,
		where: { date: params.date },
	})
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
	// const { id } = await prisma.schedule.findFirstOrThrow({
	// 	select: { id: true },
	// 	where: { date: params.date },
	// })

	switch (request.method) {
		case 'PUT':
			console.log('Not implemented')
			break
		case 'PATCH':
			console.log('Not implemented')
			break
	}
	invariantResponse(params.intent, `${request.method} Intent not handled.`, { status: 404 })
}

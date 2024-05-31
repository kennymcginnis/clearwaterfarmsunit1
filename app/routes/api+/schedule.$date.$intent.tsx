import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'

export const action = async ({ request, params }: ActionFunctionArgs) => {
	await prisma.schedule.findFirstOrThrow({
		select: { id: true },
		where: { date: params.date },
	})

	switch (request.method) {
		case 'PUT':
			switch (params.intent) {
				case 'userSchedules':
					console.log('Not implemented')
					break
			}
			break
		case 'PATCH':
			switch (params.intent) {
				case 'userSchedules':
					console.log('Not implemented')
					break
			}
			break
	}
	invariantResponse(params.intent, `${request.method} Intent not handled.`, { status: 404 })
}

import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'

export async function loader({ params }: LoaderFunctionArgs) {
	try {
		const userSchedule = await prisma.userSchedule.findFirstOrThrow({ where: { id: params.id } })
		return json(userSchedule)
	} catch (error) {
		return json({ status: 'error', error } as const, { status: 400 })
	}
}

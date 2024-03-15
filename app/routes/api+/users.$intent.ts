import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs, json, type LoaderFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'

export async function loader({ params }: LoaderFunctionArgs) {
	return await prisma.user.findMany()
}

export const action = async ({ params }: ActionFunctionArgs) => {
	switch (params.intent) {
		case 'display-name':
			const users = await prisma.user.findMany()
			users.map(async u => {
				await prisma.user.update({
					data: { display: u.username },
					where: { id: u.id },
				})
			})
			return `Complete. ${users.length} updated.`
		default:
			invariantResponse(params.intent, `Intent not handled.`, { status: 404 })
			break
	}
}

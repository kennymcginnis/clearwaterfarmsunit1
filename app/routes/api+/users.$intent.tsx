import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'
import { formatDisplayName } from '#app/utils/misc'

export async function loader() {
	return await prisma.user.findMany()
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
	switch (params.intent) {
		case 'display-name':
			const body: any = await request.json()
			if (Object.keys(body).length) {
				Object.entries(body).forEach(async ([key, value]) => {
					const user = await prisma.user.findFirst({ where: { username: key } })
					if (user && value) {
						await prisma.user.update({
							data: { display: value },
							where: { username: key },
						})
					}
				})
				return `Complete. ${Object.keys(body).length} updated.`
			} else {
				const users = await prisma.user.findMany()
				users.forEach(async ({ id, username, member }) => {
					await prisma.user.update({
						data: { display: formatDisplayName({ display: username, member }) },
						where: { id },
					})
				})
				return `Complete. ${users.length} updated.`
			}
		default:
			invariantResponse(params.intent, `Intent not handled.`, { status: 404 })
			break
	}
}

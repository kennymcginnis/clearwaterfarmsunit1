import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'
import { formatSubject } from '#app/utils/misc'

export async function loader() {
	return await prisma.user.findMany()
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
	const body: any = await request.json()
	switch (params.intent) {
		case 'display-name':
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
			}
		case 'quickbooks':
			if (Object.keys(body).length) {
				Object.entries(body).forEach(async ([key, value]) => {
					const user = await prisma.user.findFirst({ where: { username: key } })
					if (user && value) {
						await prisma.user.update({
							data: { quickbooks: value },
							where: { username: key },
						})
					}
				})
				return `Complete. ${Object.keys(body).length} updated.`
			}
		case 'username':
			if (Object.keys(body).length) {
				Object.entries(body).forEach(async ([key, value]) => {
					const user = await prisma.user.findFirst({ where: { username: key } })
					if (user && value) {
						await prisma.user.update({
							data: { username: value },
							where: { username: key },
						})
					}
				})
				return `Complete. ${Object.keys(body).length} updated.`
			}
		case 'email-subject':
			if (Object.keys(body).length) {
				Object.entries(body).forEach(async ([key, value]) => {
					const user = await prisma.user.findFirst({ where: { username: key } })
					if (user && value) {
						await prisma.user.update({
							data: { emailSubject: value },
							where: { username: key },
						})
					}
				})
				return `Complete. ${Object.keys(body).length} updated.`
			} else {
				const users = await prisma.user.findMany()
				users.forEach(async ({ id, member }) => {
					await prisma.user.update({
						data: { emailSubject: formatSubject(member) },
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

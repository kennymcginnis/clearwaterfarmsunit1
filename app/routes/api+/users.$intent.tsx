import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'

export async function loader() {
	return await prisma.user.findMany()
}

export const action = async ({ params }: ActionFunctionArgs) => {
	switch (params.intent) {
		case 'audit': {
			const found = await prisma.userAudit.findMany({
				select: {
					field: true,
					userId: true,
					updatedAt: true,
					from: true,
					to: true,
				},
			})
			let deleted = 0
			found
				.filter(({ from, to }) => from === to)
				.forEach(async ({ userId, updatedAt }) => {
					await prisma.userAudit.delete({ where: { userId_updatedAt: { userId, updatedAt } } })
					deleted++
				})

			const replace = {
				emailSubject: 'primary-subject',
				primaryEmail: 'primary-email',
				secondarySubject: 'secondary-subject',
				secondaryEmail: 'secondary-email',
			}
			let updated = 0
			found
				.filter(({ field }) => {
					// @ts-ignore
					return replace?.[field] ?? false
				})
				.forEach(async ({ userId, updatedAt, field }) => {
					await prisma.userAudit.update({
						// @ts-ignore
						data: { field: replace[field] },
						where: { userId_updatedAt: { userId, updatedAt } },
					})
					updated++
				})
			return `${deleted} rows deleted. ${updated} rows updated.`
		}
		default:
			invariantResponse(params.intent, `Intent not handled.`, { status: 404 })
			break
	}
}

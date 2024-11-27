import { prisma } from '#app/utils/db.server.ts'

export async function saveUserAudit({
	userId,
	field,
	from,
	to,
	updatedBy,
}: {
	userId: string
	field: string
	from: string | null
	to: string | null
	updatedBy: string
}) {
	try {
		if (from !== to) {
			await prisma.userAudit.create({
				data: {
					userId,
					field,
					from: from ?? 'new',
					to: to ?? 'deleted',
					updatedAt: new Date(),
					updatedBy,
				},
			})
		}
	} catch (error) {
		console.error(error)
	}
}

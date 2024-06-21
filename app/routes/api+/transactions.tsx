import { prisma } from '#app/utils/db.server.ts'

export async function loader() {
	return await prisma.transactions.findMany({
		orderBy: { updatedAt: 'desc' },
	})
}

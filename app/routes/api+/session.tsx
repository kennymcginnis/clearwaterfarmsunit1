import { prisma } from '#app/utils/db.server.ts'

type session = { [key: string]: Date }
export async function loader() {
	const sessions = await prisma.session.findMany({
		select: {
			updatedAt: true,
			user: { select: { username: true } },
		},
		orderBy: { updatedAt: 'desc' },
	})
	return sessions.reduce((agg, cur): session => {
		if (!agg[cur.user.username]) agg[cur.user.username] = cur.updatedAt
		return agg
	}, {} as session)
}

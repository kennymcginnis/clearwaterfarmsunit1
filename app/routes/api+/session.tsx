import { prisma } from '#app/utils/db.server.ts'

type session = { [key: string]: Date }
export async function loader() {
	const sessions = await prisma.session.findMany({
		select: {
			createdAt: true,
			user: { select: { username: true } },
		},
		orderBy: { createdAt: 'desc' },
	})
	return sessions.reduce((agg, cur): session => {
		if (!agg[cur.user.username]) agg[cur.user.username] = cur.createdAt
		return agg
	}, {} as session)
}

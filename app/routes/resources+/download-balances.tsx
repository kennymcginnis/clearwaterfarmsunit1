import { Readable } from 'node:stream'
import { json, createReadableStreamFromReadable } from '@remix-run/node'
import { format } from 'date-fns'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'

const UserSearchResultSchema = z.object({
	id: z.string(),
	username: z.string(),
	display: z.string(),
	member: z.string().nullable(),
	ditch: z.number(),
	position: z.number(),
	currentBalance: z.number().nullable(),
})

const UserSearchResultsSchema = z.array(UserSearchResultSchema)

export async function loader() {
	const rawUsers = await prisma.$queryRaw`
		SELECT User.id, User.username, User.display, User.member,
			Port.ditch, Port.position,
			SUM(debit - credit) AS currentBalance
		FROM User
		LEFT JOIN UserImage ON User.id = UserImage.userId
		INNER JOIN Port ON User.id = Port.userId
		LEFT JOIN Transactions ON User.id = Transactions.userId
		WHERE User.active 
		GROUP BY User.id, Port.ditch, Port.position
		ORDER BY Port.ditch, Port.position
	`

	const result = UserSearchResultsSchema.safeParse(rawUsers)
	if (!result.success) {
		return json({ status: 'error', error: result.error.message } as const, {
			status: 400,
		})
	}

	const file = createReadableStreamFromReadable(
		Readable.from(
			[
				['id', 'username', 'display', 'member', 'ditch', 'position', 'currentBalance'].join(','),
				...result.data.map(({ id, username, display, member, ditch, position, currentBalance }) =>
					[id, username, `"${display}"`, `"${member}"`, ditch, position, currentBalance].join(','),
				),
			].join('\n'),
		),
	)

	return new Response(file, {
		headers: {
			'Content-Disposition': `attachment; filename="member-balances-${format(new Date(), 'yyyy-MM-dd')}.csv"`,
			'Content-Type': 'application/csv',
		},
	})
}

import { Readable } from 'node:stream'
import { invariantResponse } from '@epic-web/invariant'
import { createReadableStreamFromReadable, type LoaderFunctionArgs } from '@remix-run/node'
import { formatInTimeZone } from 'date-fns-tz'
import { prisma } from '#app/utils/db.server'

export async function loader({ params }: LoaderFunctionArgs) {
	const user = await prisma.user.findFirst({
		select: {
			id: true,
			member: true,
			username: true,
			transactions: {
				select: {
					id: true,
					scheduleId: true,
					ditch: true,
					date: true,
					waterStart: true,
					debit: true,
					credit: true,
					note: true,
				},
				orderBy: {
					date: 'desc',
				},
			},
		},
		where: {
			username: params.username,
		},
	})

	invariantResponse(user, 'User not found', { status: 404 })

	const file = createReadableStreamFromReadable(
		Readable.from(
			[
				['id', 'scheduleId', 'ditch', 'date', 'waterStart', 'debit', 'credit', 'note'].join(','),
				...user.transactions.map(raw =>
					[
						raw.id,
						raw.scheduleId,
						raw.ditch,
						raw.date,
						raw.waterStart
							? `"${formatInTimeZone(raw.waterStart, 'Etc/UTC', 'MMM dd, h:mmaaa', { timeZone: 'Etc/UTC' })}"`
							: '',
						raw.debit,
						raw.credit,
						`"${raw.note}"`,
					].join(','),
				),
			].join('\n'),
		),
	)

	return new Response(file, {
		headers: {
			'Content-Disposition': `attachment; filename="transaction-export-${new Date().toISOString()}.csv"`,
			'Content-Type': 'application/csv',
		},
	})
}

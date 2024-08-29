import { Readable } from 'node:stream'
import { createReadableStreamFromReadable, type LoaderFunctionArgs } from '@remix-run/node'
import { getFilteredTransactions } from '#app/routes/members+/transactions+/transactions.server'

export async function loader({ request }: LoaderFunctionArgs) {
	const data = await getFilteredTransactions(request)
	const file = createReadableStreamFromReadable(
		Readable.from(
			[
				['id', 'scheduleId', 'ditch', 'userId', 'display', 'date', 'debit', 'credit', 'note'].join(','),
				...data.transactions.map(raw =>
					[
						raw.id,
						raw.scheduleId,
						raw.ditch,
						raw.user.id,
						`"${raw.user.display}"`,
						raw.date,
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

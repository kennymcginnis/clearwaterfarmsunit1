import { Readable } from 'node:stream'
import { redirect, createReadableStreamFromReadable, type LoaderFunctionArgs } from '@remix-run/node'
import { format, parse } from 'date-fns'
import { prisma } from '#app/utils/db.server.ts'

export async function loader({ params }: LoaderFunctionArgs) {
	const { date } = params
	if (!date) return redirect('/schedules')

	const transactions = await prisma.transactions.findMany({
		select: {
			user: { select: { quickbooks: true } },
			ditch: true,
			quantity: true,
			rate: true,
			credit: true,
			note: true,
		},
		where: { date, credit: { gt: 0 } },
	})

	const mmDDyyyy = format(parse(date, 'yyyy-MM-dd', new Date()), 'MM/dd/yyyy')
	const yymmDD = format(parse(date, 'yyyy-MM-dd', new Date()), 'yyMMdd')

	const file = createReadableStreamFromReadable(
		Readable.from(
			[
				[
					'* Invoice No',
					'* Customer',
					'* Invoice Date',
					'* Due Date',
					'Service Date',
					'Item (Product/Service)',
					'Item Description',
					'Item Quantity',
					'Item Rate',
					'* Item Amount',
					'Memo',
				].join(','),
				...transactions.map(({ user, ditch, quantity, rate, credit, note }, index) =>
					[
						`${yymmDD}${`00${index + 1}`.slice(-3)}`,
						`"${user?.quickbooks ?? ''}"`,
						mmDDyyyy,
						mmDDyyyy,
						mmDDyyyy,
						'Irrigation Charges',
						note,
						quantity,
						rate,
						credit,
						`Ditch ${ditch}`,
					].join(','),
				),
			].join('\n'),
		),
	)

	return new Response(file, {
		headers: {
			'Content-Disposition': `attachment; filename="quickbooks-${params.date}.csv"`,
			'Content-Type': 'application/csv',
		},
	})
}

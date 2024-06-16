import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'

export const action = async ({ params }: ActionFunctionArgs) => {
	switch (params.intent) {
		case 'positive-credits': {
			const transactions = await prisma.transactions.findMany({
				where: { credit: { lt: 0 } },
			})

			transactions.map(async t => {
				await prisma.transactions.update({
					where: { id: t.id },
					data: { credit: t.credit * -1 },
				})
			})

			return `Complete. ${transactions.length} updated.`
		}
		case 'quantity-rate': {
			const transactions = await prisma.transactions.findMany({
				where: { note: { endsWith: 'per hour' } },
			})

			transactions.map(async ({ id, note }) => {
				if (!note) return null
				let replaced = note.replace(' hours at $', '|')
				replaced = replaced.replace(' per hour', '|')
				const [quantity, rate] = replaced.split('|')
				await prisma.transactions.update({
					data: { quantity: Number(quantity), rate: Number(rate) },
					where: { id },
				})
				return { quantity, rate, note }
			})

			return `Complete. ${transactions.length} updated.`
		}
		default:
			invariantResponse(params.intent, `Intent not handled.`, { status: 404 })
			break
	}
}

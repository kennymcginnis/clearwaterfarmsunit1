import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'
import { stripe } from '#server/stripe.server'

export async function loader() {
	return await prisma.user.findMany()
}

export const action = async ({ params }: ActionFunctionArgs) => {
	switch (params.intent) {
		case 'stripe': {
			const users = await prisma.user.findMany({
				select: { id: true, member: true, quickbooks: true, primaryEmail: true },
				where: { stripeId: null },
			})
			const currentBalances = await prisma.transactions.groupBy({
				by: ['userId'],
				_sum: { debit: true },
			})

			let updated = 0
			for (const { id, member, quickbooks, primaryEmail } of users) {
				const name = member ? { name: member } : quickbooks ? { name: quickbooks } : {}
				const email = primaryEmail ? { email: primaryEmail } : {}

				const currentBalance = currentBalances.find(bal => bal.userId === id)
				const stripeUser = await stripe.customers.create({
					...name,
					...email,
					balance: (currentBalance?._sum?.debit ?? 0) * 100,
				})

				await prisma.user.update({
					select: { stripeId: true },
					data: { stripeId: stripeUser.id },
					where: { id },
				})
				updated += 1
			}
			return `Complete. ${updated} updated.`
		}
		default:
			invariantResponse(params.intent, `Intent not handled.`, { status: 404 })
			break
	}
}

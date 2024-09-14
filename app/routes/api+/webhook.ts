import { json, type ActionFunctionArgs } from '@remix-run/node'
import { format } from 'date-fns'
import { prisma } from '#app/utils/db.server'
import { stripe } from '#server/stripe.server'

async function getStripeEvent(request: Request) {
	const signature = request.headers.get('Stripe-Signature')
	const payload = await request.text()
	const event = stripe.webhooks.constructEvent(payload, signature as string, process.env.STRIPE_WEBHOOK_SECRET ?? '')
	return event
}

export async function action({ request }: ActionFunctionArgs) {
	try {
		const event = await getStripeEvent(request)
		if (event.type === 'checkout.session.completed') {
			const session = event.data.object
			const { customer, customer_email, amount_total, payment_intent, created } = session
			if (amount_total && customer) {
				const transactionFee = 30
				const processingFee = 103
				const debit = Math.round((amount_total - transactionFee) / processingFee)
				const { id: userId, primaryEmail } = await prisma.user.findFirstOrThrow({
					select: { id: true, primaryEmail: true },
					where: { stripeId: customer as string },
				})
				if (!primaryEmail) {
					await prisma.user.update({
						data: { primaryEmail: customer_email },
						where: { id: userId },
					})
				}
				await prisma.transactions.create({
					data: {
						id: payment_intent as string,
						userId,
						debit,
						date: format(new Date(created * 1000), 'yyyy-MM-dd'),
						note: `Received Online PaymentId: ${payment_intent}`,
					},
				})
			}
			console.dir({ session }, { depth: null, colors: true })
		}
		return json({ received: true })
	} catch (error) {
		return json({ status: 'error', error } as const, { status: 400 })
	}
}

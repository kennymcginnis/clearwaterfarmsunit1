import { parse } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs, json, redirect } from '@remix-run/node'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server'
import { getDomainUrl, isLocalHost } from '#app/utils/misc'
import { stripe } from '#server/stripe.server'

const adjustable_quantity = {
	enabled: true,
	minimum: 0,
	maximum: 99,
}
type LineItemsType = {
	[key: string]: {
		price: string
		quantity: number
		adjustable_quantity?: {
			enabled: boolean
			minimum: number
			maximum: number
		}
	}
}
const PaymentFormSchema = z.object({
	balance: z.number(),
	userId: z.string(),
	customer: z.string(),
})

export async function action({ request }: ActionFunctionArgs) {
	const local = isLocalHost(request)
	const SURFACE_WATER = local ? 'price_1PuU3ZRwh7qPyZNKz8QG1JQk' : 'price_1Pv6SkRwh7qPyZNKvaN0nHfs'
	const WELL_WATER = local ? 'price_1PuU2PRwh7qPyZNKm191NdT5' : 'price_1Pv6SqRwh7qPyZNKtpDrKtI9'
	const TRANSACTION_FEE = local ? 'price_1PuTxFRwh7qPyZNKLSivIlgQ' : 'price_1Pv77lRwh7qPyZNKcCPzbUNS'

	const defaultLineItems = [
		{
			price: SURFACE_WATER,
			quantity: 1,
			adjustable_quantity,
		},
		{
			price: WELL_WATER,
			quantity: 1,
			adjustable_quantity,
		},
	]

	if (request.method !== 'POST') return json({ message: 'Method now allowed' }, 405)
	const formData = await request.formData()
	const submission = parse(formData, { schema: PaymentFormSchema })
	invariantResponse(submission?.value, 'Invalid submission', { status: 404 })
	const { userId, customer } = submission.value
	const balanceDue = submission.value.balance * -1

	const transactions = await prisma.transactions.findMany({
		select: { rate: true, quantity: true },
		where: { userId },
		orderBy: { date: 'desc' },
	})

	const lineItems: LineItemsType = {
		9: {
			price: SURFACE_WATER,
			quantity: 0,
			adjustable_quantity,
		},
		10: {
			price: WELL_WATER,
			quantity: 0,
			adjustable_quantity,
		},
	}

	// loop through transactions until the quantity*rate matches the balance due
	let runningTotal = 0
	while (transactions.length && runningTotal < balanceDue) {
		for (const { quantity, rate } of transactions) {
			if (!quantity || !rate) continue
			const roundedUp = Math.ceil(quantity)
			for (let i = 1; i <= roundedUp; i++) {
				if (runningTotal >= balanceDue) break
				runningTotal += rate
				lineItems[rate].quantity += 1
			}
		}
	}
	// filter line items with zero quantity
	let line_items = Object.values(lineItems).filter(({ quantity }) => Boolean(quantity))
	if (!line_items.length) line_items = [...defaultLineItems]
	line_items.push({ price: TRANSACTION_FEE, quantity: 1 })
	const domainUrl = getDomainUrl(request)
	const session = await stripe.checkout.sessions.create({
		mode: 'payment',
		customer,
		phone_number_collection: {
			enabled: true,
		},
		line_items,
		success_url: `${domainUrl}?payment=success`,
		cancel_url: `${domainUrl}?payment=cancelled`,
	})
	return redirect(session.url as string)
}

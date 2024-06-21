import { json, type ActionFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'
import { generatePublicId } from '#app/utils/public-id'
import { DateSchema } from '#app/utils/user-validation'

export const action = async ({ request }: ActionFunctionArgs) => {
	const TransactionSchema = z
		.object({
			// create
			id: z.undefined(),
			userId: z.string(),
			date: DateSchema,
			debit: z.number().optional(),
			credit: z.number().optional(),
			note: z.string().optional(),
		})
		.or(
			// update
			z.object({
				id: z.string(),
				userId: z.string().optional(),
				date: DateSchema.optional(),
				debit: z.number().optional(),
				credit: z.number().optional(),
				note: z.string().optional(),
			}),
		)

	const result = TransactionSchema.safeParse(await request.json())
	if (!result.success) {
		return json({ status: 'error', error: result.error.message } as const, {
			status: 400,
		})
	}
	const { id, ...data } = result.data

	// Create - POST
	// Upsert - PUT
	// Update - PATCH
	switch (request.method) {
		case 'POST':
			try {
				if (id) {
					return json({ status: 'skipped', message: '`id` provided, should this be a put or patch?' })
				} else {
					const transaction = await prisma.transactions.create({
						// @ts-ignore
						data: {
							...data,
							id: generatePublicId(),
							updatedAt: new Date(),
						},
					})
					return json({ status: 'created', transaction })
				}
			} catch (error) {
				return json({ status: 'error', error } as const, { status: 400 })
			}
		case 'PUT':
		case 'PATCH':
			try {
				if (id) {
					const transaction = await prisma.transactions.update({
						include: { user: true },
						data: { ...data, updatedAt: new Date() },
						where: { id },
					})
					return json({ status: 'updated', transaction })
				} else {
					return json({ status: 'skipped', message: 'No `id` provided, should this be a post?' })
				}
			} catch (error) {
				return json({ status: 'error', error } as const, { status: 400 })
			}
		case 'DELETE':
			const TransactionDeleteSchema = z.object({ id: z.string().array() })
			const result = TransactionDeleteSchema.safeParse(await request.json())
			if (!result.success) {
				return json({ status: 'error', error: result.error.message } as const, {
					status: 400,
				})
			}
			try {
				const transaction = await prisma.transactions.deleteMany({ where: { id: { in: result.data.id } } })
				return json({ status: 'success', transaction })
			} catch (error) {
				return json({ status: 'error', error } as const, { status: 400 })
			}
	}
}

import { invariantResponse } from '@epic-web/invariant'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'
import { stripe } from '#server/stripe.server'

export const action = async ({ request, params }: ActionFunctionArgs) => {
	const { id, member, quickbooks, primaryEmail } = await prisma.user.findFirstOrThrow({
		select: { id: true, member: true, quickbooks: true, primaryEmail: true },
		where: { username: params.username },
	})
	invariantResponse(id, `User ${params.username} not found.`, { status: 404 })

	switch (request.method) {
		case 'POST':
		case 'PUT':
			switch (params.intent) {
				case 'stripe': {
					const name = member ? { name: member } : quickbooks ? { name: quickbooks } : {}
					const email = primaryEmail ? { email: primaryEmail } : {}
					const currentBalance = await prisma.transactions.groupBy({
						by: ['userId'],
						_sum: { debit: true },
						where: { userId: id },
					})
					const stripeUser = await stripe.customers.create({
						...name,
						...email,
						balance: (currentBalance[0]?._sum?.debit ?? 0) * 100,
					})

					const updated = await prisma.user.update({
						select: { stripeId: true },
						data: { stripeId: stripeUser.id },
						where: { id },
					})
					console.dir({ updated })

					return stripeUser
				}
				case 'moved': {
					const updated = await prisma.user.update({
						select: { id: true, username: true, active: true, ports: { select: { ditch: true, position: true } } },
						data: { active: false },
						where: { id },
					})
					// decrement every position after moved user
					for (let port of updated.ports) {
						const ports = await prisma.port.findMany({
							where: {
								ditch: port.ditch,
								position: { gte: port.position },
							},
						})
						ports.map(async p => {
							await prisma.port.update({
								data: { position: p.position === port.position ? 0 : p.position - 1 },
								where: { id: p.id },
							})
						})
					}
					return json({ status: 'updated', ...updated } as const, { status: 200 })
				}
				case 'restricted': {
					const PutUserRestrictedSchema = z.object({ restricted: z.boolean().nullable(), restriction: z.string().optional() })
					const result = PutUserRestrictedSchema.safeParse(await request.json())
					if (!result.success) {
						return json({ status: 'error', error: result.error.message } as const, {
							status: 400,
						})
					}
					const { restricted, restriction } = result.data
					return await prisma.user.update({
						select: { id: true, username: true, restricted: true, restriction: true },
						data: { restricted, restriction },
						where: { id },
					})
				}
				case 'roles': {
					const PutUserRolesSchema = z.object({ connect: z.object({ name: z.string() }).array() })
					const result = PutUserRolesSchema.safeParse(await request.json())
					if (!result.success) {
						return json({ status: 'error', error: result.error.message } as const, {
							status: 400,
						})
					}
					return await prisma.user.update({
						select: { id: true, username: true, roles: { select: { name: true } } },
						data: { roles: result.data },
						where: { id },
					})
				}
				case 'emails': {
					const PutEmailSchema = z.object({
						primaryEmail: z.string().optional(),
						secondaryEmail: z.string().optional(),
					})
					const result = PutEmailSchema.safeParse(await request.json())
					if (!result.success) {
						return json({ status: 'error', error: result.error.message } as const, {
							status: 400,
						})
					}
					await prisma.user.update({
						data: { ...result.data },
						where: { id },
					})
					return json({ status: 'updated', ...result } as const, { status: 200 })
				}
			}
		case 'PATCH':
			switch (params.intent) {
				case 'roles':
			}
	}
	invariantResponse(params.intent, `${request.method} Intent not handled.`, { status: 404 })
}

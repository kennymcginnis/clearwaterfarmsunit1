import { invariantResponse } from '@epic-web/invariant'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'
import { saveUserAudit } from '#app/utils/user-audit.ts'
import { stripe } from '#server/stripe.server'

export const action = async ({ request, params }: ActionFunctionArgs) => {
	const current = await prisma.user.findFirstOrThrow({
		select: {
			id: true,
			member: true,
			quickbooks: true,
			primaryEmail: true,
			secondaryEmail: true,
			stripeId: true,
			roles: { select: { name: true } },
		},
		where: { username: params.username },
	})
	const { id, member, quickbooks, primaryEmail } = current
	invariantResponse(id, `User ${params.username} not found.`, { status: 404 })

	switch (request.method) {
		case 'POST':
		case 'PUT':
			switch (params.intent) {
				case 'stripe': {
					const name = member ? { name: member } : quickbooks ? { name: quickbooks } : {}
					const email = primaryEmail ? { email: primaryEmail } : {}

					const stripeUser = await stripe.customers.create({
						...name,
						...email,
					})

					if (stripeUser.id) {
						await prisma.user.update({
							select: { stripeId: true },
							data: { stripeId: stripeUser.id },
							where: { id },
						})
						await saveUserAudit({
							userId: id,
							field: 'stripeId',
							from: current?.stripeId,
							to: stripeUser.id,
							updatedBy: 'Admin',
						})
					}
					return stripeUser
				}
				case 'moved': {
					const updated = await prisma.user.update({
						select: { id: true, username: true, active: true, ports: { select: { ditch: true, position: true } } },
						data: { active: false },
						where: { id },
					})
					await saveUserAudit({
						userId: id,
						field: 'active',
						from: 'true',
						to: 'false',
						updatedBy: 'Admin',
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
				case 'roles': {
					const PutUserRolesSchema = z.object({ connect: z.object({ name: z.string() }).array() })
					const result = PutUserRolesSchema.safeParse(await request.json())
					if (!result.success) {
						return json({ status: 'error', error: result.error.message } as const, {
							status: 400,
						})
					}
					const current = await prisma.user.findFirst({
						select: { roles: { select: { name: true } } },
						where: { id },
					})
					const updated = await prisma.user.update({
						select: { id: true, username: true, roles: { select: { name: true } } },
						data: { roles: result.data },
						where: { id },
					})
					await saveUserAudit({
						userId: id,
						field: 'roles',
						from: (current?.roles ?? []).map(role => role.name).join(','),
						to: (updated.roles ?? []).map(role => role.name).join(','),
						updatedBy: 'Admin',
					})
					return updated
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
						select: { primaryEmail: true, secondaryEmail: true },
						data: { ...result.data },
						where: { id },
					})
					if (result.data.primaryEmail) {
						await saveUserAudit({
							userId: id,
							field: 'primaryEmail',
							from: primaryEmail,
							to: result.data.primaryEmail,
							updatedBy: 'Admin',
						})
					}
					if (result.data.secondaryEmail) {
						await saveUserAudit({
							userId: id,
							field: 'secondaryEmail',
							from: (current?.roles ?? []).map(role => role.name).join(','),
							to: result.data.secondaryEmail,
							updatedBy: 'Admin',
						})
					}
					return json({ status: 'updated', ...result } as const, { status: 200 })
				}
			}
	}
	invariantResponse(params.intent, `${request.method} Intent not handled.`, { status: 404 })
}

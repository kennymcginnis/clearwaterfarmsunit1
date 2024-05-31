import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs, type LoaderFunctionArgs, json } from '@remix-run/node'
import { z } from 'zod'
import { createPassword } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server.ts'
import { generatePublicId } from '#app/utils/public-id'
import { AddressSchema, DepositsSchema, PhoneSchema, PortsSchema } from '#app/utils/user-validation'

export async function loader({ params }: LoaderFunctionArgs) {
	return await prisma.user.findMany()
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
	switch (params.intent) {
		case 'display-name':
			const users = await prisma.user.findMany()
			users.map(async u => {
				await prisma.user.update({
					data: { display: u.username },
					where: { id: u.id },
				})
			})
			return `Complete. ${users.length} updated.`
		case 'create-with-address':
			console.log('Creating a user and Address:')
			const CreateUserSchema = z.object({
				id: z.undefined(),
				username: z.string(),
				member: z.string(),
				display: z.string(),
				userAddress: AddressSchema.array(),
				primaryEmail: z.string(),
				secondaryEmail: z.string().optional(),
				phone: PhoneSchema.array(),
				ports: PortsSchema.array(),
				deposits: DepositsSchema.array(),
			})
			try {
				const result = CreateUserSchema.safeParse(await request.json())
				if (!result.success) {
					console.error(JSON.stringify(result.error.message))
					return json({ status: 'error', error: result.error.message } as const, {
						status: 400,
					})
				}
				const userData = result.data

				const { id } = await prisma.user.create({
					select: { id: true },
					data: {
						id: generatePublicId(),
						username: userData.username,
						member: userData.member,
						display: userData.display,
						active: true,
						userAddress: {
							create: userData?.userAddress?.map(ua => ({
								id: generatePublicId(),
								active: true,
								address: {
									create: {
										id: generatePublicId(),
										address: ua.address,
										parcelAndLot: {
											create: (ua.parcelAndLot || []).map(pl => ({ id: generatePublicId(), ...pl })),
										},
									},
								},
							})),
						},
						primaryEmail: userData.primaryEmail,
						secondaryEmail: userData.secondaryEmail,
						phones: { create: (userData.phone || []).map(v => ({ id: generatePublicId(), ...v })) },
						ports: {
							create: (userData.ports || []).map(({ position, ...v }) => ({
								id: generatePublicId(),
								position: Math.ceil(position),
								...v,
							})),
						},
						password: { create: createPassword(userData.username) },
						transactions: {
							create: (userData.deposits || []).map(({ amount, ...deposit }) => ({
								id: generatePublicId(),
								...deposit,
								credit: amount < 0 ? amount * -1 : 0,
								debit: amount > 0 ? amount : 0,
							})),
						},
						roles: { connect: { name: 'user' } },
					},
				})

				// if position is a decimal, increment every position after
				for (let port of userData.ports) {
					if (Number.isInteger(port.position)) continue
					const ports = await prisma.port.findMany({
						where: {
							ditch: port.ditch,
							position: { gt: port.position },
							userId: { not: id },
						},
					})
					ports.map(async p => {
						await prisma.port.update({
							data: { position: p.position + 1 },
							where: { id: p.id },
						})
					})
				}
				return json({ status: 'created', id } as const, { status: 200 })
			} catch (error) {
				console.error('Error creating a user:', error)
				return json({ status: 'error', error } as const, { status: 400 })
			}
		default:
			invariantResponse(params.intent, `Intent not handled.`, { status: 404 })
			break
	}
}

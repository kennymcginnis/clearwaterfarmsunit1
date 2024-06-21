import { type ActionFunctionArgs, json } from '@remix-run/node'
import { z } from 'zod'
import { createPassword } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server.ts'
import { generatePublicId } from '#app/utils/public-id'
import { DepositsSchema, PhoneSchema, PortsSchema } from '#app/utils/user-validation'

export const action = async ({ request }: ActionFunctionArgs) => {
	// Create - POST
	// Upsert - PUT
	// Update - PATCH
	switch (request.method) {
		case 'POST':
			console.log('Creating a user and Address:')
			const CreateUserSchema = z
				.object({
					id: z.string().optional(),
					username: z.string(),
					member: z.string(),
					display: z.string().optional(),
					address: z.string(),
					primaryEmail: z.string().optional(),
					secondaryEmail: z.string().optional(),
					phone: PhoneSchema.array().optional(),
					ports: PortsSchema.array(),
					deposits: DepositsSchema.array(),
				})
				.array()
			try {
				const result = CreateUserSchema.safeParse(await request.json())
				if (!result.success) {
					console.error(JSON.stringify(result.error.message))
					return json({ status: 'error', error: result.error.message } as const, {
						status: 400,
					})
				}

				let response = []

				for (const userData of result.data) {
					if (userData.id) {
						const userId = await prisma.user.findFirst({ select: { id: true }, where: { id: userData.id } })
						if (userId) {
							response.push({
								status: 'error',
								message: 'User with this ID already exists.',
								address: userData.id,
							})
							continue
						}
					}

					const address = await prisma.address.findFirst({ where: { address: userData.address } })

					if (!address) {
						response.push({ status: 'error', message: 'Could not find an existing address', address: userData.address })
						continue
					}

					const { id } = await prisma.user.create({
						select: { id: true },
						data: {
							id: userData.id ?? generatePublicId(),
							username: userData.username,
							member: userData.member,
							display: userData.display ?? userData.member,
							active: true,
							userAddress: {
								create: {
									id: generatePublicId(),
									addressId: address.id,
								},
							},
							primaryEmail: userData.primaryEmail ?? `${userData.username}@example.com`,
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
					response.push({ status: 'created', id })
				}

				return json(response)
			} catch (error) {
				console.error('Error creating a user:', error)
				return json({ status: 'error', error } as const, { status: 400 })
			}
		case 'DELETE':
		case 'PUT':
		case 'PATCH':
	}
}

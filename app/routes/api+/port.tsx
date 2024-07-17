import { json, type ActionFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'
import { generatePublicId } from '#app/utils/public-id'

export async function loader() {
	return await prisma.port.findMany()
}

export const action = async ({ request }: ActionFunctionArgs) => {
	const PortSchema = z
		.object({
			// create
			id: z.undefined(),
			ditch: z.number().optional(),
			position: z.number().optional(),
			section: z.string().optional(),
			entry: z.string().optional(),
		})
		.or(
			// update
			z.object({
				id: z.string(),
				ditch: z.number().optional(),
				position: z.number().optional(),
				section: z.string().optional(),
				entry: z.string().optional(),
			}),
		)

	// const body: any = await request.json()
	switch (request.method) {
		case 'POST':
			try {
				const result = PortSchema.safeParse(await request.json())
				if (!result.success) {
					return json({ status: 'error', error: result.error.message } as const, {
						status: 400,
					})
				}
				const { id, ...data } = result.data
				if (id) {
					return json({ status: 'skipped', message: '`id` provided, should this be a put or patch?' })
				} else {
					const port = await prisma.port.create({
						// @ts-ignore
						data: {
							...data,
							id: generatePublicId(),
							updatedAt: new Date(),
						},
					})
					return json({ status: 'created', port })
				}
			} catch (error) {
				return json({ status: 'error', error } as const, { status: 400 })
			}
		case 'PUT':
		case 'PATCH':
			try {
				const result = PortSchema.safeParse(await request.json())
				if (!result.success) {
					return json({ status: 'error', error: result.error.message } as const, {
						status: 400,
					})
				}
				const { id, ...data } = result.data
				if (id) {
					const port = await prisma.port.update({
						include: { user: true },
						data: { ...data, updatedAt: new Date() },
						where: { id },
					})
					return json({ status: 'updated', port })
				} else {
					return json({ status: 'skipped', message: 'No `id` provided, should this be a post?' })
				}
			} catch (error) {
				return json({ status: 'error', error } as const, { status: 400 })
			}
	}
}

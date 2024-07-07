import { type Prisma } from '@prisma/client'
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'
import { generatePublicId } from '#app/utils/public-id'

export async function loader({ request }: LoaderFunctionArgs) {
	const query = new URL(request.url).searchParams

	const id = query.get('id')
	const userId = query.get('userId')
	const scheduleId = query.get('scheduleId')
	const ditch = query.get('ditch')

	const where: Prisma.UserScheduleWhereInput = {}
	if (id) where.id = id
	if (userId) where.userId = userId
	if (scheduleId) where.scheduleId = scheduleId
	if (ditch) where.ditch = Number(ditch)
	console.dir({ where })

	try {
		const userSchedules = await prisma.userSchedule.findMany({ where })
		return json(userSchedules)
	} catch (error) {
		return json({ status: 'error', error } as const, { status: 400 })
	}
}

export const action = async ({ request }: ActionFunctionArgs) => {
	const UserScheduleSchema = z
		.object({
			// create
			id: z.undefined(),
			userId: z.string().optional(),
			ditch: z.number().optional(),
			scheduleId: z.string().optional(),
			hours: z.number().optional(),
			start: z.coerce.date().optional(),
			stop: z.coerce.date().optional(),
		})
		.or(
			// update
			z.object({
				id: z.string(),
				userId: z.string().optional(),
				ditch: z.number().optional(),
				scheduleId: z.string().optional(),
				hours: z.number().optional(),
				start: z.coerce.date().optional(),
				stop: z.coerce.date().optional(),
			}),
		)

	const result = UserScheduleSchema.safeParse(await request.json())
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
					const userSchedule = await prisma.userSchedule.create({
						// @ts-ignore
						data: {
							...data,
							id: generatePublicId(),
							updatedAt: new Date(),
						},
					})
					return json({ status: 'created', userSchedule })
				}
			} catch (error) {
				return json({ status: 'error', error } as const, { status: 400 })
			}
		case 'PUT':
		case 'PATCH':
			try {
				if (id) {
					const userSchedule = await prisma.userSchedule.update({
						include: { user: true },
						data: { ...data, updatedAt: new Date() },
						where: { id },
					})
					return json({ status: 'updated', userSchedule })
				} else {
					return json({ status: 'skipped', message: 'No `id` provided, should this be a post?' })
				}
			} catch (error) {
				return json({ status: 'error', error } as const, { status: 400 })
			}
		case 'DELETE':
			const UserScheduleDeleteSchema = z.object({ id: z.string().array() })
			const result = UserScheduleDeleteSchema.safeParse(await request.json())
			if (!result.success) {
				return json({ status: 'error', error: result.error.message } as const, {
					status: 400,
				})
			}
			try {
				const userSchedule = await prisma.userSchedule.deleteMany({ where: { id: { in: result.data.id } } })
				return json({ status: 'success', userSchedule })
			} catch (error) {
				return json({ status: 'error', error } as const, { status: 400 })
			}
	}
}

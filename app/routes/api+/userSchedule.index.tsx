import { json, type ActionFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'
import { generatePublicId } from '#app/utils/public-id'
import { DateSchema } from '#app/utils/user-validation'

export const action = async ({ request }: ActionFunctionArgs) => {
	const UserScheduleSchema = z
		.object({
			// create
			id: z.undefined(),
			userId: z.string().optional(),
			ditch: z.number().optional(),
			scheduleId: z.string().optional(),
			hours: z.number().optional(),
			start: DateSchema.optional(),
			stop: DateSchema.optional(),
		})
		.or(
			// update
			z.object({
				id: z.string(),
				userId: z.string().optional(),
				ditch: z.number().optional(),
				scheduleId: z.string().optional(),
				hours: z.number().optional(),
				start: DateSchema.optional(),
				stop: DateSchema.optional(),
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
					return json({ status: 'created', userschedule: userSchedule })
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
					return json({ status: 'updated', userschedule: userSchedule })
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
				const userschedule = await prisma.userSchedule.deleteMany({ where: { id: { in: result.data.id } } })
				return json({ status: 'success', userschedule })
			} catch (error) {
				return json({ status: 'error', error } as const, { status: 400 })
			}
	}
}

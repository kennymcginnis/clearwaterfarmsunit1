import { type Prisma } from '@prisma/client'
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'

export async function loader({ request }: LoaderFunctionArgs) {
	const query = new URL(request.url).searchParams

	const userId = query.get('userId')
	const scheduleId = query.get('scheduleId')
	const ditch = query.get('ditch')

	const where: Prisma.UserScheduleWhereInput = {}
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
				userId: z.string().optional(),
				ditch: z.number().optional(),
				scheduleId: z.string().optional(),
				hours: z.number().optional(),
				start: z.coerce.date().optional(),
				stop: z.coerce.date().optional(),
			}),
		)

	// Create - POST
	// Upsert - PUT
	// Update - PATCH
	switch (request.method) {
		case 'POST':
			try {
				const result = UserScheduleSchema.safeParse(await request.json())
				if (!result.success) {
					return json({ status: 'error', error: result.error.message } as const, { status: 400 })
				}
				const userSchedule = await prisma.userSchedule.create({
					// @ts-ignore
					data: {
						...result.data,
						updatedAt: new Date(),
					},
				})
				return json({ status: 'created', userSchedule })
			} catch (error) {
				return json({ status: 'error', error } as const, { status: 400 })
			}
	}
}

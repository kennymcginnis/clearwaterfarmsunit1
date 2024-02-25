import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs, json } from '@remix-run/node'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'
import { generatePublicId } from '#app/utils/public-id'

const select = {
	date: true,
	deadline: true,
	source: true,
	costPerHour: true,
	state: true,
	start: true,
	stop: true,
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
	// const { id } = await prisma.schedule.findFirstOrThrow({
	// 	select: { id: true },
	// 	where: { date: params.date },
	// })

	switch (request.method) {
		case 'PUT':
			const stringRegex = /^\d{4}-[01]\d-[0-3]\d$/
			const UpsertScheduleSchema = z
				.object({
					id: z.undefined(),
					source: z.string(),
					costPerHour: z.number(),
					state: z.string().optional().default('pending'),
					date: z.string().regex(stringRegex),
					deadline: z.string().regex(stringRegex),
					start: z
						.number()
						.transform(value => new Date(value))
						.optional(),
					stop: z
						.number()
						.transform(value => new Date(value))
						.optional(),
				})
				.or(
					z.object({
						id: z.string(),
						source: z.string().optional(),
						costPerHour: z.number().optional(),
						state: z.string().optional(),
						date: z.string().regex(stringRegex).optional(),
						deadline: z.string().regex(stringRegex).optional(),
						start: z
							.number()
							.transform(value => new Date(value))
							.optional(),
						stop: z
							.number()
							.transform(value => new Date(value))
							.optional(),
					}),
				)

			const result = UpsertScheduleSchema.safeParse(await request.json())
			if (!result.success) {
				return json({ status: 'error', error: result.error.message } as const, {
					status: 400,
				})
			}
			const { id, ...data } = result.data
			try {
				return await prisma.schedule.upsert({
					select,
					where: { id },
					// @ts-ignore
					create: { ...data, id: generatePublicId() },
					update: data,
				})
			} catch (error) {
				return json({ status: 'error', error } as const, { status: 400 })
			}
		case 'PATCH':
			console.log('Not implemented')
			break
	}
	invariantResponse(params.intent, `${request.method} Intent not handled.`, { status: 404 })
}

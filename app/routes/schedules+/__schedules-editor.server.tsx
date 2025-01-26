import { parse } from '@conform-to/zod'
import {
	unstable_createMemoryUploadHandler as createMemoryUploadHandler,
	json,
	unstable_parseMultipartFormData as parseMultipartFormData,
	redirect,
	type ActionFunctionArgs,
} from '@remix-run/node'
import { z } from 'zod'
import { requireUserId } from '#app/utils/auth.server.ts'
import { validateCSRF } from '#app/utils/csrf.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { generatePublicId } from '#app/utils/public-id'

const stringRegex = /^\d{4}-[01]\d-[0-3]\d$/

const ScheduleEditorSchema = z.object({
	id: z.string().optional(),
	source: z.string(),
	costPerHour: z.number(),
	date: z.string().regex(stringRegex),
	deadline: z.string().regex(stringRegex),
})

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request)

	const formData = await parseMultipartFormData(request, createMemoryUploadHandler())
	await validateCSRF(formData, request.headers)

	const submission = await parse(formData, {
		schema: ScheduleEditorSchema.superRefine(async (data, ctx) => {
			const existingSchedule = await prisma.schedule.findFirst({
				select: { id: true },
				where: { date: data.date, NOT: { id: data.id } },
			})
			if (existingSchedule) {
				ctx.addIssue({
					path: ['date'],
					code: z.ZodIssueCode.custom,
					message: 'A schedule already exists with this date',
				})
				return
			}

			if (!data.id) return
			const schedule = await prisma.schedule.findUnique({
				select: { id: true },
				where: { id: data.id },
			})
			if (!schedule) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Schedule not found',
				})
			}
		}),
		async: true,
	})

	console.dir({ submission })

	if (submission.intent !== 'submit') {
		return json({ submission } as const)
	}

	if (!submission.value) {
		return json({ submission } as const, { status: 400 })
	}

	const { id: scheduleId, date, deadline, source, costPerHour } = submission.value

	const updatedSchedule = await prisma.schedule.upsert({
		select: { id: true, date: true },
		where: { id: scheduleId ?? '__new_schedule__' },
		create: {
			id: generatePublicId(),
			date,
			deadline,
			source,
			costPerHour,
			updatedBy: userId,
		},
		update: {
			date,
			deadline,
			source,
			costPerHour,
			updatedBy: userId,
		},
	})

	return redirect(`/schedules/${updatedSchedule.date}`)
}

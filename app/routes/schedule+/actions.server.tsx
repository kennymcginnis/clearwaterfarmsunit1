import { parse } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import {
	json,
	type ActionFunctionArgs,
	type UploadHandler,
	unstable_composeUploadHandlers as composeUploadHandlers,
	unstable_createMemoryUploadHandler as createMemoryUploadHandler,
	unstable_parseMultipartFormData as parseMultipartFormData,
} from '@remix-run/node'
import { parseISO } from 'date-fns'
import { z } from 'zod'
import { ActionFormSchema } from '#app/routes/schedules+/$date'
import { validateCSRF } from '#app/utils/csrf.server.ts'
import { csvFileToArray, csvUploadHandler } from '#app/utils/csv-helper.ts'
import { prisma } from '#app/utils/db.server.ts'
import { requireUserWithRole } from '#app/utils/permissions.ts'
import { generatePublicId } from '#app/utils/public-id'
import { redirectWithToast } from '#app/utils/toast.server.ts'

type ScheduleActionArgs = {
	request: Request
	userId: string
	schedule: { id: string; date: string; costPerHour: number }
	formData: FormData
}

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserWithRole(request, 'admin')
	const formData = await request.formData()
	await validateCSRF(formData, request.headers)
	const intent = formData.get('intent')

	const scheduleId = formData.get('scheduleId')
	invariantResponse(typeof scheduleId === 'string', 'scheduleId must be a string')
	const schedule = await prisma.schedule.findFirst({
		select: { id: true, date: true, costPerHour: true },
		where: { id: scheduleId },
	})
	invariantResponse(schedule, 'Schedule Not found', { status: 404 })

	const actionArgs = { schedule, userId, formData, request }
	switch (intent) {
		case 'delete-schedule':
			return await deleteScheduleAction(actionArgs)

		case 'open-schedule':
			return await openScheduleAction(actionArgs)

		case 'lock-schedule':
			return await lockScheduleAction(actionArgs)

		case 'close-schedule':
			return await closeScheduleAction(actionArgs)

		case 'upload-signup':
			return await uploadSignupAction(actionArgs)

		case 'upload-timeline':
			return await uploadTimelineAction(actionArgs)

		default:
			throw new Response(`Invalid intent "${intent}"`, { status: 400 })
	}
}

async function openScheduleAction({ userId, schedule, formData }: ScheduleActionArgs) {
	const submission = parse(formData, { schema: ActionFormSchema })
	if (submission.value) {
		const alreadyOpen = await prisma.schedule.findFirst({
			select: { id: true, date: true },
			where: { state: 'open' },
			orderBy: { date: 'desc' },
		})
		if (alreadyOpen) {
			return json({ status: 'error', submission } as const, { status: 406 })
		}
		await prisma.schedule.update({
			data: { state: 'open', updatedBy: userId },
			where: { id: schedule.id },
		})
		return redirectWithToast('.', {
			type: 'success',
			title: 'Success',
			description: `Schedule has been opened.`,
		})
	} else {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
}

async function lockScheduleAction({ userId, schedule, formData }: ScheduleActionArgs) {
	const submission = parse(formData, { schema: ActionFormSchema })
	if (submission.value) {
		await prisma.schedule.update({
			data: { state: 'locked', updatedBy: userId },
			where: { id: schedule.id },
		})
		return redirectWithToast('.', {
			type: 'success',
			title: 'Success',
			description: `Schedule has been locked.`,
		})
	} else {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
}

async function deleteScheduleAction({ formData, schedule }: ScheduleActionArgs) {
	const submission = parse(formData, { schema: ActionFormSchema })
	if (submission.value) {
		await prisma.schedule.delete({ where: { id: schedule.id } })
		return redirectWithToast('.', {
			type: 'success',
			title: 'Success',
			description: 'Your schedule has been deleted.',
		})
	} else {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
}

async function closeScheduleAction({ userId, schedule, formData }: ScheduleActionArgs) {
	const submission = parse(formData, { schema: ActionFormSchema })

	if (submission.value) {
		const userSchedules = await prisma.userSchedule.findMany({
			select: { userId: true, hours: true },
			where: { scheduleId: schedule.id },
		})

		for (const userSchedule of userSchedules) {
			if (userSchedule.hours > 0) {
				await prisma.transactions.create({
					data: {
						id: generatePublicId(),
						userId: userSchedule.userId,
						credit: userSchedule.hours * schedule.costPerHour,
						date: schedule.date,
						note: `${userSchedule.hours} hours at $${schedule.costPerHour} per hour`,
						createdBy: userId,
					},
				})
			}
		}

		const { _min, _max } = await prisma.userSchedule.aggregate({
			_min: { start: true },
			_max: { stop: true },
			where: { scheduleId: schedule.id },
		})
		await prisma.schedule.update({
			where: { id: schedule.id },
			data: {
				state: 'closed',
				start: _min.start,
				stop: _max.stop,
				updatedBy: userId,
			},
		})
		return redirectWithToast(`.`, {
			type: 'success',
			title: 'Success',
			description: `${userSchedules.length} Debits created. Schedule closed.`,
		})
	} else {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
}

const UploadSignupSchema = z.array(
	z.object({
		id: z.string(),
		username: z.string(),
		ditch: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(9)),
		position: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(36)),
		hours: z.preprocess(x => (x ? x : 0), z.coerce.number().multipleOf(0.01).min(0).max(36)),
		head: z.preprocess(x => (x ? x : 70), z.coerce.number().multipleOf(70).min(70).max(140)),
	}),
)
async function uploadSignupAction({ schedule, request }: ScheduleActionArgs) {
	const userId = await requireUserWithRole(request, 'admin')

	const uploadHandler: UploadHandler = composeUploadHandlers(csvUploadHandler, createMemoryUploadHandler())
	const formData = await parseMultipartFormData(request, uploadHandler)

	const csv = formData.get('selected_csv')
	invariantResponse(typeof csv === 'string', 'selected_csv filename must be a string')

	const userSchedules = csvFileToArray(csv)
	const result = UploadSignupSchema.safeParse(userSchedules)
	if (!result.success) {
		return json({ status: 'error', error: result.error.message } as const, {
			status: 400,
		})
	}

	for (let userSchedule of result.data) {
		await prisma.userSchedule.upsert({
			select: { scheduleId: true, ditch: true, userId: true },
			where: {
				userId_ditch_scheduleId: { userId: userSchedule.id, ditch: userSchedule.ditch, scheduleId: schedule.id },
			},
			create: {
				userId: userSchedule.id,
				ditch: userSchedule.ditch,
				scheduleId: schedule.id,
				hours: userSchedule.hours,
				head: userSchedule.head,
				createdBy: userId,
			},
			update: {
				hours: userSchedule.hours,
				head: userSchedule.head,
				updatedBy: userId,
			},
		})
	}

	return redirectWithToast('.', {
		type: 'success',
		title: 'Success',
		description: 'Your schedule has been uploaded.',
	})
}

const UploadTimelineSchema = z.array(
	z.object({
		id: z.string(),
		username: z.string(),
		ditch: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(9)),
		position: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(36)),
		hours: z.preprocess(x => (x ? x : 0), z.coerce.number().multipleOf(0.01).min(0).max(36)),
		head: z.preprocess(x => (x ? x : 70), z.coerce.number().multipleOf(70).min(70).max(140)),
		start: z.preprocess(x => (x && typeof x === 'string' ? parseISO(x) : null), z.date().nullable()),
		stop: z.preprocess(x => (x && typeof x === 'string' ? parseISO(x) : null), z.date().nullable()),
	}),
)
async function uploadTimelineAction({ schedule, request }: ScheduleActionArgs) {
	const userId = await requireUserWithRole(request, 'admin')

	const uploadHandler: UploadHandler = composeUploadHandlers(csvUploadHandler, createMemoryUploadHandler())
	const formData = await parseMultipartFormData(request, uploadHandler)

	const csv = formData.get('selected_csv')
	invariantResponse(typeof csv === 'string', 'selected_csv filename must be a string')

	const userSchedules = csvFileToArray(csv)
	const result = UploadTimelineSchema.safeParse(userSchedules)
	if (!result.success) {
		return json({ status: 'error', error: result.error.message } as const, { status: 400 })
	}

	for (let userSchedule of result.data) {
		await prisma.userSchedule.upsert({
			create: {
				userId: userSchedule.id,
				ditch: userSchedule.ditch,
				scheduleId: schedule.id,
				hours: userSchedule.hours,
				head: userSchedule.head,
				start: userSchedule.start,
				stop: userSchedule.stop,
				createdBy: userId,
			},
			update: {
				hours: userSchedule.hours,
				head: userSchedule.head,
				start: userSchedule.start,
				stop: userSchedule.stop,
				updatedBy: userId,
			},
			where: {
				userId_ditch_scheduleId: { userId: userSchedule.id, ditch: userSchedule.ditch, scheduleId: schedule.id },
			},
		})
	}

	return redirectWithToast('.', {
		type: 'success',
		title: 'Success',
		description: 'Your timeline has been uploaded.',
	})
}

import { parseWithZod } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { validateCSRF } from '#app/utils/csrf.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { requireUserWithRole } from '#app/utils/permissions.server'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { UserScheduleEditorSchema } from './__schedule-editor'

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
	invariantResponse(
		typeof scheduleId === 'string',
		'scheduleId must be a string',
	)
	const schedule = await prisma.schedule.findFirst({
		select: { id: true, date: true, costPerHour: true },
		where: { id: scheduleId },
	})
	invariantResponse(schedule, 'Schedule Not found', { status: 404 })

	const actionArgs = { schedule, userId, formData, request }
	switch (intent) {
		case 'update-user-schedule':
			return await updateUserScheduleAction(actionArgs)

		default:
			throw new Response(`Invalid intent "${intent}"`, { status: 400 })
	}
}

export async function updateUserScheduleAction({
	userId: updatedBy,
	formData,
}: ScheduleActionArgs) {
	const submission = await parseWithZod(formData, {
		schema: UserScheduleEditorSchema,
		async: true,
	})

	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}
	const { userId, ditch, scheduleId, hours } = submission.value

	await prisma.userSchedule.upsert({
		select: { userId: true, ditch: true, scheduleId: true },
		where: { userId_ditch_scheduleId: { userId, ditch, scheduleId } },
		create: {
			userId,
			scheduleId,
			ditch,
			hours,
			updatedBy,
		},
		update: {
			hours,
			updatedBy,
		},
	})

	return redirectWithToast('', {
		type: 'success',
		title: 'Success',
		description: `${hours} hours saved for ditch ${ditch}.`,
	})
}

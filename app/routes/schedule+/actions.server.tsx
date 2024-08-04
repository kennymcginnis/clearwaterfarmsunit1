import { parse } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { ClosedScheduleEmail } from '#app/components/ClosedScheduleEmail'
import { validateCSRF } from '#app/utils/csrf.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { sendEmail } from '#app/utils/email.server.ts'
import { formatDatesOneLiner } from '#app/utils/misc'
import { requireUserWithRole } from '#app/utils/permissions.ts'
import { generatePublicId } from '#app/utils/public-id'
import { redirectWithToast } from '#app/utils/toast.server.ts'

const ActionFormSchema = z.object({
	intent: z.string(),
	scheduleId: z.string(),
})

type ScheduleActionArgs = {
	request: Request
	userId: string
	schedule: { id: string; date: string; costPerHour: number }
	formData: FormData
}

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserWithRole(request, 'admin')
	console.dir({ request })
	const formData = await request.formData()
	console.dir({ formData })
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

		case 'closed-emails':
			return await closedEmailsAction(actionArgs)

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
	const { id: scheduleId, date, costPerHour } = schedule

	if (submission.value) {
		const userSchedules = await prisma.userSchedule.findMany({
			select: { userId: true, hours: true, ditch: true, start: true },
			where: { scheduleId },
		})
		for (const { userId, ditch, hours, start } of userSchedules) {
			if (start && hours) {
				await prisma.transactions.create({
					data: {
						id: generatePublicId(),
						scheduleId,
						userId,
						ditch,
						credit: hours * costPerHour,
						date,
						waterStart: start,
						quantity: hours,
						rate: costPerHour,
						note: `${hours} hours at $${costPerHour} per hour`,
						updatedBy: userId,
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

async function closedEmailsAction({ schedule, formData }: ScheduleActionArgs) {
	const submission = parse(formData, { schema: ActionFormSchema })
	const { id: scheduleId } = schedule

	if (submission.value) {
		const userSchedules = await prisma.userSchedule.findMany({
			select: {
				user: {
					select: {
						primaryEmail: true,
						emailSubject: true,
					},
				},
				ditch: true,
				start: true,
				stop: true,
			},
			where: { scheduleId, user: { roles: { some: { name: 'admin' } } } },
		})

		type EmailType = {
			[key: string]: {
				emailSubject: string | null
				schedules: { ditch: number; schedule: string }[]
			}
		}
		const emails: EmailType = {}
		for (const {
			ditch,
			start,
			stop,
			user: { emailSubject, primaryEmail },
		} of userSchedules) {
			if (start && stop) {
				if (primaryEmail) {
					const schedule = { ditch, schedule: formatDatesOneLiner({ start, stop }) }
					if (emails[primaryEmail]) emails[primaryEmail].schedules.push(schedule)
					else emails[primaryEmail] = { emailSubject, schedules: [schedule] }
				}
			}
		}

		for (const [primaryEmail, { emailSubject, schedules }] of Object.entries(emails)) {
			sendEmail({
				to: primaryEmail,
				subject: `Clearwater Farms 1 Schedule Closed`,
				react: <ClosedScheduleEmail emailSubject={emailSubject ?? ''} schedules={schedules} />,
			})
		}
		return redirectWithToast(`.`, {
			type: 'success',
			title: 'Success',
			description: `${Object.keys(emails).length} Emails sent.`,
		})
	} else {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
}

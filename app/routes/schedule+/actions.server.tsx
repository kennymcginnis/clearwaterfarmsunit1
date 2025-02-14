import { parse } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { Resend } from 'resend'
import { z } from 'zod'
import { ClosedScheduleEmail } from '#app/components/email/ClosedScheduleEmail'
import { validateCSRF } from '#app/utils/csrf.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { formatDatesOneLiner, formatHours } from '#app/utils/misc'
import { requireUserWithRole } from '#app/utils/permissions.ts'
import { generatePublicId } from '#app/utils/public-id'
import { redirectWithToast } from '#app/utils/toast.server.ts'

type EmailType = {
	[key: string]: {
		user: { id: string; emailSubject: string; trained: boolean }
		schedules: {
			ditch: number
			entry: string | null
			hours: string
			schedule: string
			first: boolean | null
			crossover: boolean | null
			last: boolean | null
			firstId?: string | null
			crossoverId?: string | null
		}[]
	}
}

const ActionFormSchema = z.object({
	intent: z.string(),
	scheduleId: z.string(),
})

type ScheduleActionArgs = {
	request: Request
	userId: string
	schedule: { id: string; date: string; costPerHour: number; start: Date | null; stop: Date | null }
	formData: FormData
}

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserWithRole(request, 'admin')
	// console.dir({ request })
	const formData = await request.formData()
	// console.dir({ formData })
	await validateCSRF(formData, request.headers)
	const intent = formData.get('intent')

	const scheduleId = formData.get('scheduleId')
	invariantResponse(typeof scheduleId === 'string', 'scheduleId must be a string')
	const schedule = await prisma.schedule.findFirst({
		select: { id: true, date: true, costPerHour: true, start: true, stop: true },
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

		case 'test-email':
			return await testEmailAction(actionArgs)

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
			select: {
				userId: true,
				port: { select: { ditch: true } },
				hours: true,
				start: true,
			},
			where: { scheduleId },
		})
		for (const {
			userId,
			port: { ditch },
			hours,
			start,
		} of userSchedules) {
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
						emailed: true,
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
	const { id: scheduleId, date } = schedule

	const userSchedules = await prisma.userSchedule.findMany({
		select: {
			user: {
				select: {
					id: true,
					emailSubject: true,
					primaryEmail: true,
					secondarySubject: true,
					secondaryEmail: true,
					trained: true,
				},
			},
			port: { select: { ditch: true, entry: true } },
			hours: true,
			start: true,
			stop: true,
			first: true,
			crossover: true,
			last: true,
			firstId: true,
			crossoverId: true,
		},
		where: { scheduleId, hours: { gt: 0 } },
	})

	const emails: EmailType = {}
	userSchedules.forEach(
		({
			user: { id: userId, emailSubject, primaryEmail, secondarySubject, secondaryEmail, trained },
			port,
			hours,
			start,
			stop,
			...userSchedule
		}) => {
			const schedule = {
				...userSchedule,
				...port,
				hours: formatHours(hours),
				schedule: formatDatesOneLiner({ start, stop }),
				trained,
			}
			if (primaryEmail) {
				if (emails[primaryEmail]) emails[primaryEmail].schedules.push(schedule)
				else
					emails[primaryEmail] = {
						user: { id: userId, emailSubject: emailSubject ?? primaryEmail, trained },
						schedules: [schedule],
					}
			}
			if (secondaryEmail) {
				if (emails[secondaryEmail]) emails[secondaryEmail].schedules.push(schedule)
				else {
					emails[secondaryEmail] = {
						user: { id: userId, emailSubject: secondarySubject ?? emailSubject ?? secondaryEmail, trained },
						schedules: [schedule],
					}
				}
			}
		},
	)
	const batchEmails = Object.entries(emails).map(([email, { user, schedules }]) => ({
		from: 'clearwat@clearwaterfarmsunit1.com',
		to: email,
		subject: `Clearwater Farms Unit 1 - Schedule ${date} Generated`,
		react: <ClosedScheduleEmail date={date} user={user} schedules={schedules} />,
	}))

	const resend = new Resend(process.env.RESEND_API_KEY)
	const { data, error } = await resend.batch.send(batchEmails)

	if (error) {
		return json({ status: 'error', submission } as const, { status: 500 })
	} else {
		return redirectWithToast(`.`, {
			type: 'success',
			title: 'Success',
			description: `${data}`,
		})
	}
}

async function testEmailAction({ schedule, formData }: ScheduleActionArgs) {
	const submission = parse(formData, { schema: ActionFormSchema })
	const { date, start, stop } = schedule

	const email = 'kenneth.j.mcginnis@gmail.com'
	const emailSubject = 'Ken & Emily'
	const schedules = [
		{
			portId: 'fpfq-hedp-yndt',
			ditch: 7,
			entry: 'South',
			hours: formatHours(1.5),
			schedule: formatDatesOneLiner({ start, stop }),
			first: true,
			crossover: true,
			last: true,
			firstId: 'f34x-h9f4-56r2',
			crossoverId: 't5b4-y62n-kwqm',
		},
	]
	const batchEmails = [
		{
			from: 'clearwat@clearwaterfarmsunit1.com',
			to: email,
			subject: `Clearwater Farms Unit 1 - Schedule ${date} Generated`,
			react: <ClosedScheduleEmail date={date} user={{ emailSubject, trained: false }} schedules={schedules} />,
		},
	]

	const resend = new Resend(process.env.RESEND_API_KEY)
	const { data, error } = await resend.batch.send(batchEmails)

	if (error) {
		return json({ status: 'error', submission } as const, { status: 500 })
	} else {
		return redirectWithToast(`.`, {
			type: 'success',
			title: 'Success',
			description: `${data}`,
		})
	}
}

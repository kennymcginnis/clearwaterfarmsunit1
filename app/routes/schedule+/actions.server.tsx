import { parse } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { format } from 'date-fns'
import { Resend } from 'resend'
import { z } from 'zod'
import { ClosedScheduleEmail } from '#app/components/email/ClosedScheduleEmail'
import { validateCSRF } from '#app/utils/csrf.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { formatDatesOneLiner, formatHours } from '#app/utils/misc'
import { requireUserWithRole } from '#app/utils/permissions.ts'
import { generatePublicId } from '#app/utils/public-id'
import { redirectWithToast } from '#app/utils/toast.server.ts'

const SearchResultsSchema = z.array(
	z.object({
		userId: z.string(),
		emailSubject: z.string().nullish(),
		primaryEmail: z.string().email().nullish(),
		secondarySubject: z.string().nullish(),
		secondaryEmail: z.string().email().nullish(),
		portId: z.string(),
		ditch: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(9)),
		position: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(99)),
		entry: z.string(),
		section: z.string(),
		hours: z.preprocess(x => (x ? x : 0), z.coerce.number().multipleOf(0.5).min(0).max(36)),
		start: z.date().nullable(),
		stop: z.date().nullable(),
		first: z.boolean().nullable(),
		crossover: z.boolean().nullable(),
		last: z.boolean().nullable(),
	}),
)

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
	// console.dir({ request })
	const formData = await request.formData()
	// console.dir({ formData })
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
	const scheduleDate = format(date, 'eeee, MMM do')

	if (submission.value) {
		const rawUsers = await prisma.$queryRaw`
			SELECT User.id AS userId, User.emailSubject, User.primaryEmail, User.secondarySubject, User.secondaryEmail, 
						 Port.id AS portId, Port.ditch, Port.position, Port.entry, Port.section, 
						 UserSchedule.hours, UserSchedule.start, UserSchedule.stop,
						 UserSchedule.first, UserSchedule.crossover, UserSchedule.last
	  		FROM User
	  	 INNER JOIN Port ON User.id = Port.userId
	  	  LEFT JOIN UserSchedule
	  	    ON User.id = UserSchedule.userId
	  	   AND Port.id = UserSchedule.portId
	  	   AND UserSchedule.scheduleId = ${scheduleId}
	  	 WHERE User.active
			   AND UserSchedule.hours > 0
	  	 ORDER BY Port.ditch, Port.position
		`

		const result = SearchResultsSchema.safeParse(rawUsers)
		if (!result.success) {
			console.error(result.error.message)
			return null
		}

		type EmailType = {
			[key: string]: {
				userId: string
				emailSubject: string
				schedules: {
					portId: string
					ditch: number
					entry: string
					hours: string
					schedule: string
					first: boolean | null
					crossover: boolean | null
					last: boolean | null
				}[]
			}
		}
		const emails: EmailType = {}
		result.data.forEach(
			({
				userId,
				portId,
				ditch,
				entry,
				hours,
				start,
				stop,
				first,
				crossover,
				last,
				emailSubject,
				primaryEmail,
				secondarySubject,
				secondaryEmail,
			}) => {
				const schedule = {
					portId,
					ditch,
					entry,
					hours: formatHours(hours),
					schedule: formatDatesOneLiner({ start, stop }),
					first,
					crossover,
					last,
				}
				if (primaryEmail) {
					if (emails[primaryEmail]) emails[primaryEmail].schedules.push(schedule)
					else emails[primaryEmail] = { userId, emailSubject: emailSubject ?? primaryEmail, schedules: [schedule] }
				}
				if (secondaryEmail) {
					if (emails[secondaryEmail]) emails[secondaryEmail].schedules.push(schedule)
					else {
						emails[secondaryEmail] = {
							userId,
							emailSubject: secondarySubject ?? emailSubject ?? secondaryEmail,
							schedules: [schedule],
						}
					}
				}
			},
		)
		const batchEmails = Object.entries(emails).map(([email, { userId, emailSubject, schedules }]) => ({
			from: 'clearwat@clearwaterfarmsunit1.com',
			to: email,
			subject: `Clearwater Farms Unit 1 - Schedule ${date} Generated`,
			react: (
				<ClosedScheduleEmail
					scheduleId={scheduleId}
					date={scheduleDate}
					userId={userId}
					emailSubject={emailSubject}
					schedules={schedules}
				/>
			),
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
	} else {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
}

async function testEmailAction({ schedule, formData }: ScheduleActionArgs) {
	const submission = parse(formData, { schema: ActionFormSchema })
	const { id: scheduleId, date } = schedule
	const scheduleDate = format(date, 'eeee, MMM do')

	if (submission.value) {
		const rawUsers = await prisma.$queryRaw`
			SELECT User.id AS userId, User.emailSubject, User.primaryEmail, User.secondarySubject, User.secondaryEmail, 
						 Port.id AS portId, Port.ditch, Port.position, Port.entry, Port.section, 
						 UserSchedule.hours, UserSchedule.start, UserSchedule.stop,
						 UserSchedule.first, UserSchedule.crossover, UserSchedule.last
	  		FROM User
	  	 INNER JOIN Port ON User.id = Port.userId
	  	  LEFT JOIN UserSchedule
	  	    ON User.id = UserSchedule.userId
	  	   AND Port.id = UserSchedule.portId
	  	   AND UserSchedule.scheduleId = ${scheduleId}
	  	 WHERE UserSchedule.first = true
			   AND UserSchedule.acknowledgeFirst != true
	  	 ORDER BY Port.ditch, Port.position
			 LIMIT 1
		`

		const result = SearchResultsSchema.safeParse(rawUsers)
		if (!result.success) {
			console.error(result.error.message)
			return null
		}

		type EmailType = {
			[key: string]: {
				userId: string
				emailSubject: string
				schedules: {
					portId: string
					ditch: number
					entry: string
					hours: string
					schedule: string
					first: boolean | null
					crossover: boolean | null
					last: boolean | null
				}[]
			}
		}
		const emails: EmailType = {}
		result.data.forEach(
			({
				userId,
				portId,
				ditch,
				entry,
				hours,
				start,
				stop,
				first,
				crossover,
				last,
				emailSubject,
				primaryEmail,
				secondarySubject,
				secondaryEmail,
			}) => {
				const schedule = {
					portId,
					ditch,
					entry,
					hours: formatHours(hours),
					schedule: formatDatesOneLiner({ start, stop }),
					first,
					crossover,
					last,
				}
				if (primaryEmail) {
					if (emails[primaryEmail]) emails[primaryEmail].schedules.push(schedule)
					else emails[primaryEmail] = { userId, emailSubject: emailSubject ?? primaryEmail, schedules: [schedule] }
				}
				if (secondaryEmail) {
					if (emails[secondaryEmail]) emails[secondaryEmail].schedules.push(schedule)
					else {
						emails[secondaryEmail] = {
							userId,
							emailSubject: secondarySubject ?? emailSubject ?? secondaryEmail,
							schedules: [schedule],
						}
					}
				}
			},
		)
		const batchEmails = Object.entries(emails).map(([email, { userId, emailSubject, schedules }]) => ({
			from: 'clearwat@clearwaterfarmsunit1.com',
			to: 'kenneth.j.mcginnis@gmail.com',
			subject: `Clearwater Farms Unit 1 - Schedule ${date} Generated`,
			react: (
				<ClosedScheduleEmail
					scheduleId={scheduleId}
					date={scheduleDate}
					userId={userId}
					emailSubject={emailSubject}
					schedules={schedules}
				/>
			),
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
	} else {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
}

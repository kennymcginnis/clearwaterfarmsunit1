import { invariantResponse } from '@epic-web/invariant'
import { type LoaderFunctionArgs, json } from '@remix-run/node'
import { formatDistanceToNow, subDays } from 'date-fns'
import { z } from 'zod'
import { getUserId } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server.ts'
import { parseMdx } from '#app/utils/mdx-bundler.server'
import { formatClosedUserSchedule, formatDates, formatOpenUserSchedule } from '#app/utils/misc'

export async function loader({ request }: LoaderFunctionArgs) {
	const type = 'announcements'
	const document = await prisma.document.findFirst({
		select: {
			title: true,
			content: true,
			meeting: { select: { date: true } },
			images: { select: { id: true } },
			updatedBy: true,
			updatedAt: true,
		},
		where: { type },
		orderBy: { updatedAt: 'desc' },
	})
	invariantResponse(document, `No announcements found`, { status: 404 })

	const query = new URL(request.url).searchParams
	const { enabled } = (await prisma.featureToggle.findUnique({
		select: { enabled: true },
		where: { name: 'stripe-payments' },
	})) ?? { enabled: false }
	const success = Boolean(query.get('payment') === 'success')
	const cancelled = Boolean(query.get('payment') === 'cancelled')

	const date = new Date(document.updatedAt)
	const timeAgo = formatDistanceToNow(date)

	let content = await parseMdx(document.content.toString())
	invariantResponse(content, `Error parsing MDX file.`, { status: 404 })

	const userId = await getUserId(request)
	const select = {
		id: true,
		date: true,
		deadline: true,
		source: true,
		costPerHour: true,
		state: true,
		start: true,
		stop: true,
	}
	if (userId) {
		const user = await prisma.user.findFirstOrThrow({
			select: {
				id: true,
				username: true,
				display: true,
				stripeId: true,
				defaultHours: true,
				restricted: true,
				restriction: true,
				ports: { select: { id: true, ditch: true, position: true, entry: true, section: true } },
			},
			where: { id: userId },
		})

		const UserSearchResultsSchema = z.array(z.object({ balance: z.number() }))
		const currentBalance = await prisma.$queryRaw`
			SELECT sum(debit - credit) as balance
				FROM Transactions
			WHERE userId = ${userId}
		`
		const result = UserSearchResultsSchema.safeParse(currentBalance)
		const balance = result.success ? result.data[0].balance : 0

		// a null user restriction means "auto-restrict" when they owe more than $50
		if (user.restricted === null && balance <= -50) {
			user.restriction = 'Restricted for Irrigation Balance'
			user.restricted = true
		}

		const userSchedules = {
			select: {
				userId: true,
				port: {
					select: {
						id: true,
						ditch: true,
						position: true,
						entry: true,
						section: true,
					},
				},
				first: true,
				crossover: true,
				last: true,
				hours: true,
				start: true,
				stop: true,
			},
		}

		const allSchedules = await prisma.schedule.findMany({
			select: { ...select, userSchedules },
			where: { state: 'closed' },
			orderBy: { date: 'asc' },
		})

		// find the next future dated schedule for the user - offset 1day because of -7hrs PHX timezone
		const yesterday = subDays(new Date(), 1)
		let closed = allSchedules.find(s => s.userSchedules.some(us => us?.start && us.start > yesterday))
		// if none, then use the most recently closed schedule
		if (!closed) closed = allSchedules.pop()
		invariantResponse(closed, 'No Closed Schedules Found', { status: 404 })
		const closedSchedules = {
			...closed,
			schedule: formatDates({ start: closed?.start ?? null, stop: closed?.stop ?? null }),
		}
		const closedUserSchedules = formatClosedUserSchedule(user, closed?.userSchedules)

		const open = await prisma.schedule.findFirst({
			select: { ...select, userSchedules },
			where: { state: 'open' },
			orderBy: { date: 'desc' },
		})
		const openSchedules = open ? { ...open, schedule: [] } : null
		const openUserSchedules = formatOpenUserSchedule(user, open?.userSchedules, closed?.userSchedules)
		return json({
			type,
			document,
			content,
			timeAgo,
			user,
			balance,
			open: openSchedules,
			closed: closedSchedules,
			userSchedules: { open: openUserSchedules, closed: closedUserSchedules },
			payment: { enabled, success, cancelled },
		})
	} else {
		const open = await prisma.schedule.findFirst({
			select,
			where: { state: 'open' },
			orderBy: { date: 'desc' },
		})
		const openSchedules = open ? { ...open, schedule: [] } : null
		const closed = await prisma.schedule.findFirst({
			select,
			where: { state: 'closed' },
			orderBy: { date: 'desc' },
		})
		const closedSchedules = {
			...closed,
			schedule: formatDates({ start: closed?.start ?? null, stop: closed?.stop ?? null }),
		}
		return json({
			type,
			document,
			content,
			timeAgo,
			user: null,
			balance: null,
			open: openSchedules,
			closed: closedSchedules,
			userSchedules: { open: null, closed: null },
			payment: { enabled, success, cancelled },
		})
	}
}

import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Card, CardContent } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon'
import { requireSelfOrAdmin } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server.ts'
import { formatDates } from '#app/utils/misc'
import { UserScheduleEditor, action } from './__schedule-editor'
import { UserScheduleTimeline } from './__schedule-timeline'

export { action }
export async function loader({ request, params }: LoaderFunctionArgs) {
	const { date, username } = params
	invariantResponse(date, 'Date parameter Not found', { status: 404 })
	invariantResponse(username, 'Username parameter Not found', { status: 404 })

	const schedule = await prisma.schedule.findFirst({
		select: {
			id: true,
			state: true,
			source: true,
		},
		where: { date },
	})
	invariantResponse(schedule?.id, 'Schedule Not found', { status: 404 })

	await requireSelfOrAdmin({ request, params }, { redirectTo: `/schedule/${date}` })

	const user = await prisma.user.findFirstOrThrow({
		select: {
			id: true,
			username: true,
			display: true,
			defaultHours: true,
			restricted: true,
			restriction: true,
			ports: {
				select: {
					id: true,
					ditch: true,
					position: true,
					entry: true,
					section: true,
				},
			},
		},
		where: { username },
	})

	const existing = await prisma.userSchedule.findMany({
		select: {
			user: { select: { username: true } },
			port: {
				select: {
					id: true,
					ditch: true,
					position: true,
					entry: true,
					section: true,
				},
			},
			hours: true,
			start: true,
			stop: true,
		},
		where: { scheduleId: schedule.id },
		orderBy: { port: { ditch: 'asc', position: 'asc' } },
	})

	/*
	type ChargesType = {
		[key: number]: { first: Boolean; last: Boolean; crossover: Boolean }
	}

	const charges: ChargesType = user.ports.reduce((agg, port) => {
		const first = existing.some(us => us.port.ditch === port.ditch && us.port.position < port.position) ?? false
		const last = existing.some(us => us.port.ditch === port.ditch && us.port.position > port.position) ?? false
		const crossover =
			port.section === 'South' || port.section === 'East'
				? existing.some(
						us =>
							us.port.ditch === port.ditch &&
							us.port.entry === port.entry &&
							us.port.section === port.section &&
							us.port.position < port.position,
					)
				: false
		agg[port.ditch] = { first, last, crossover }
		return agg
	}, {} as ChargesType)
	*/

	const UserSearchResultsSchema = z.array(z.object({ balance: z.number() }))
	const currentBalance = await prisma.$queryRaw`
		SELECT sum(debit - credit) as balance
			FROM Transactions
		 WHERE userId = ${user.id}
	`
	const result = UserSearchResultsSchema.safeParse(currentBalance)
	const balance = result.success ? result.data[0].balance : 0

	// a null user restriction means "auto-restrict" when they owe more than $50
	if (user.restricted === null && balance <= -50) {
		user.restriction = 'Restricted for Irrigation Balance'
		user.restricted = true
	}

	const userSchedules = existing
		.filter(us => us.user.username === username)
		.map(us => ({ ...us, schedule: formatDates({ start: us.start, stop: us.stop }) }))
	for (const port of user.ports) {
		const found = userSchedules.some(us => us.port.id === port.id)
		if (!found) {
			userSchedules.push({
				port,
				user: { username },
				hours: user.defaultHours,
				start: null,
				stop: null,
				schedule: [],
			})
		}
	}
	return json({ user, schedule, userSchedules /*, charges */ })
}

export default function UserSchedule() {
	const { user, schedule, userSchedules /*, charges */ } = useLoaderData<typeof loader>()
	return (
		<div className="m-auto flex h-full w-[50%] min-w-[350px] flex-col content-between gap-4 p-4">
			{userSchedules.map(userSchedule => {
				const ditch = userSchedule.port.ditch
				switch (schedule.state) {
					case 'open':
						return (
							<UserScheduleEditor
								key={`schedule-${ditch}`}
								user={user}
								schedule={schedule}
								userSchedule={userSchedule}
							/>
						)
					case 'closed':
						return <UserScheduleTimeline key={`timeline-${ditch}`} user={user} userSchedule={userSchedule} />
					case 'pending':
					case 'locked':
						return (
							<div key={`locked-${ditch}`}>
								<Card>
									<CardContent>
										<Icon name="lock-closed" className="mb-1 mr-2 scale-100 max-md:scale-125"></Icon>
										This Schedule has not yet been {{ pending: 'opened', locked: 'finalized' }[schedule.state]}.
									</CardContent>
								</Card>
							</div>
						)
					default:
						return (
							<div key={`locked-${ditch}`}>
								<Card>
									<CardContent>
										<Icon name="lock-closed" className="mb-1 mr-2 scale-100 max-md:scale-125"></Icon>
										This Schedule is in an invalid state. Reach out for support.
									</CardContent>
								</Card>
							</div>
						)
				}
			})}
		</div>
	)
}

export const meta: MetaFunction<null, { 'routes/schedule+/$date_': typeof loader }> = ({ params }) => {
	return [
		{ title: `Irrigation ${params.date} | Clearwater Farms 1` },
		{
			name: 'description',
			content: `Irrigation for ${params.date} Clearwater Farms 1`,
		},
	]
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => <p>No schedule with the id "{params.scheduleId}" exists</p>,
			}}
		/>
	)
}

import { type LoaderFunctionArgs, json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { DisplayField } from '#app/components/forms'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#app/components/ui/card'
import { getUserId } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server.ts'
import { formatSchedule, formatUserSchedule } from '#app/utils/misc'
import { UserScheduleEditor, action } from './schedule+/__schedule-editor'
import { UserScheduleTimeline } from './schedule+/__schedule-timeline'

export { action }

export async function loader({ request }: LoaderFunctionArgs) {
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
				defaultHours: true,
				defaultHead: true,
				restricted: true,
				ports: { select: { ditch: true } },
			},
			where: { id: userId },
		})
		const userSchedules = {
			select: {
				ditch: true,
				hours: true,
				head: true,
				start: true,
				stop: true,
			},
			where: { userId },
		}

		const closed = await prisma.schedule.findFirst({
			select: { ...select, userSchedules },
			where: { state: 'closed' },
			orderBy: { date: 'desc' },
		})
		const closedSchedules = formatSchedule(closed)
		const closedUserSchedules = formatUserSchedule(user, closed?.userSchedules)

		const open = await prisma.schedule.findFirst({
			select: { ...select, userSchedules },
			where: { state: 'open' },
			orderBy: { date: 'desc' },
		})
		const openSchedules = open ? { ...open, schedule: [] } : null
		const openUserSchedules = formatUserSchedule(user, open?.userSchedules, closed?.userSchedules)
		return json({
			user,
			open: openSchedules,
			closed: closedSchedules,
			userSchedules: {
				open: openUserSchedules,
				closed: closedUserSchedules,
			},
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
		const closedSchedules = formatSchedule(closed)
		return json({
			user: null,
			open: openSchedules,
			closed: closedSchedules,
			userSchedules: { open: null, closed: null },
		})
	}
}

export default function HomeRoute() {
	const { user, open, closed, userSchedules } = useLoaderData<typeof loader>()
	return (
		<div className="flex flex-col items-center gap-5">
			{!user ? (
				<h1 className="text-xl">Log in to sign up for the current schedule.</h1>
			) : (
				<div id="closed" className="m-auto grid h-full flex-row content-between gap-4 p-4 md:grid-cols-2">
					<div className="flex-col">
						{closed ? (
							<Card className="bg-muted">
								<CardHeader className="flex-col items-center">
									<CardTitle>Schedule Dated: {closed.date}</CardTitle>
									{closed.start && closed.stop ? (
										<CardDescription>{closed.schedule.join(' ─ ')}</CardDescription>
									) : null}
								</CardHeader>
								<CardContent className="flex-col gap-2">
									{userSchedules.closed ? (
										userSchedules.closed.map(userSchedule => (
											<UserScheduleTimeline
												key={`timeline-${userSchedule.ditch}`}
												user={user}
												userSchedule={userSchedule}
											/>
										))
									) : (
										<MissingUserSchedule schedule={userSchedules.closed} />
									)}
								</CardContent>
							</Card>
						) : (
							<Card className="bg-muted">
								<CardHeader>
									<CardTitle>No Closed schedules found!</CardTitle>
								</CardHeader>
								<CardContent />
							</Card>
						)}
					</div>

					<div id="open" className="flex-col">
						{open ? (
							<Card className="bg-muted">
								<CardHeader className="flex-col items-center">
									<CardTitle>Open Until: {open.deadline}</CardTitle>
									<CardDescription>Sign-Up Deadline Monday at 7pm</CardDescription>
								</CardHeader>
								<CardContent className="flex flex-col gap-2">
									{userSchedules.open ? (
										userSchedules.open.map(userSchedule => (
											<UserScheduleEditor
												key={`schedule-${userSchedule.ditch}`}
												user={user}
												schedule={open}
												previous={userSchedule.previous}
												userSchedule={userSchedule}
											/>
										))
									) : (
										<MissingUserSchedule schedule={open} />
									)}
								</CardContent>
							</Card>
						) : (
							<Card className="bg-muted">
								<CardHeader>
									<CardTitle>No schedules are currently open for Sign-Up!</CardTitle>
								</CardHeader>
								<CardContent />
							</Card>
						)}
					</div>
				</div>
			)}
		</div>
	)
}
function MissingUserSchedule({
	schedule,
}: {
	schedule: {
		date?: string
		deadline?: string
		source?: string
		costPerHour?: number
	}
}) {
	return (
		<>
			<DisplayField labelProps={{ children: 'Date' }} inputProps={{ defaultValue: schedule.date }} />
			<DisplayField labelProps={{ children: 'Deadline' }} inputProps={{ defaultValue: schedule.deadline }} />
			<DisplayField labelProps={{ children: 'Source' }} inputProps={{ defaultValue: schedule.source }} />
			<DisplayField labelProps={{ children: 'Cost Per Hour' }} inputProps={{ defaultValue: schedule.costPerHour }} />
		</>
	)
}

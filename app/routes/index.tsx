import { invariantResponse } from '@epic-web/invariant'
import { type LoaderFunctionArgs, json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { formatDistanceToNow } from 'date-fns'
import { z } from 'zod'
import { DisplayField } from '#app/components/forms'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon'
import { getUserId } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server.ts'
import { parseMdx } from '#app/utils/mdx-bundler.server'
import { formatDay, formatSchedule, formatUserSchedule } from '#app/utils/misc'
import AnnouncementsComponent from './_marketing+/announcements'
import { UserScheduleEditor, action } from './schedule+/__schedule-editor'
import { UserScheduleTimeline } from './schedule+/__schedule-timeline'

export { action }

export async function loader({ request, params }: LoaderFunctionArgs) {
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

	invariantResponse(document, `No ${params.type} document found`, {
		status: 404,
	})

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
				defaultHours: true,
				restricted: true,
				restriction: true,
				ports: { select: { ditch: true } },
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

		const userSchedules = {
			select: {
				ditch: true,
				hours: true,
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
			type,
			document,
			content,
			timeAgo,
			user,
			balance,
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
			type,
			document,
			content,
			timeAgo,
			user: null,
			balance: null,
			open: openSchedules,
			closed: closedSchedules,
			userSchedules: { open: null, closed: null },
		})
	}
}

export default function HomeRoute() {
	const USDollar = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

	const { user, balance, open, closed, userSchedules } = useLoaderData<typeof loader>()
	if (user) {
		return (
			<div className="flex w-full flex-col items-center">
				<h2 className="flex flex-nowrap pt-3 text-3xl font-semibold leading-none tracking-tight">
					Clearwater Farms Unit 1
				</h2>
				<div className="mb-0 text-xl">Irrigation Schedules</div>
				
				{/* 				
				<div
					style={{ width: 'clamp(352px, 75%, 720px)' }}
					className="m-auto mt-2 rounded-md border-2 border-secondary px-3 py-1 text-center align-bottom"
				>
					<Icon className="mr-1 h-6 w-6 text-yellow-600" name="exclamation-triangle" />
					<strong>Zach Walter</strong>: (623) 256-7077
					<br />
					Please call at the time of the problem!
				</div> 
				*/}

				{user.restricted ? (
					<div
						style={{ width: 'clamp(352px, 75%, 720px)' }}
						className="m-auto mt-2 flex flex-col rounded-md border border-destructive px-3 py-2"
					>
						<div className="text-md text-center uppercase text-foreground-destructive">User Account Restricted</div>
						<div className="text-center text-sm text-foreground-destructive">{user.restriction}</div>
					</div>
				) : null}
				{balance ? (
					<div
						style={{ width: 'clamp(352px, 75%, 720px)' }}
						className="m-auto mt-2 flex flex-col rounded-md border border-blue-700 px-3 py-2"
					>
						<div className="text-center text-lg text-blue-700">Irrigation Balance: {USDollar.format(balance)}</div>
					</div>
				) : null}

				<div id="columns" className="m-auto flex h-full flex-wrap justify-center gap-4 p-4">
					<div id="closed" className="w-[352px] flex-col">
						<CardDescription className="text-center">Most Recently Closed Schedule:</CardDescription>
						{closed ? (
							<ClosedSchedule closed={closed} userSchedules={userSchedules} user={user} />
						) : (
							<Card className="bg-muted">
								<CardHeader>
									<CardTitle>No Closed schedules found!</CardTitle>
								</CardHeader>
								<CardContent />
							</Card>
						)}
					</div>

					<div id="open" className="w-[352px] flex-col">
						<CardDescription className="text-center">Currently Open for Sign-Up:</CardDescription>
						{open ? (
							<OpenSchedule open={open} userSchedules={userSchedules} user={user} />
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
				<AnnouncementsComponent />
			</div>
		)
	} else {
		return (
			<>
				<Card className="m-6 flex flex-col items-center gap-5">
					<CardHeader className="m-auto w-[50%] flex-col items-center border-none">
						<CardTitle className="pt-3">Clearwater Farms Unit 1</CardTitle>
						<CardDescription className="pb-3">Log in to sign up for the current schedule.</CardDescription>
					</CardHeader>
				</Card>
				<AnnouncementsComponent />
			</>
		)
	}
}

function OpenSchedule({
	open,
	userSchedules,
	user,
}: {
	open: {
		id: string
		date: string
		deadline: string
		source: string
		costPerHour: number
	}
	userSchedules: {
		open: {
			ditch: number
			hours: number | null
			previous: number | null
		}[]
	}
	user: {
		id: string
		display: string | null
		defaultHours: number
		restricted: boolean
		restriction: string | null
	}
}) {
	return (
		<Card className="bg-muted">
			<CardHeader className="flex-col items-center">
				<CardTitle>Open Until: {open.deadline}</CardTitle>
				<CardDescription>Sign-Up Deadline {formatDay(open.deadline)} at 7pm</CardDescription>
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
	)
}

function ClosedSchedule({
	closed,
	userSchedules,
	user,
}: {
	closed: {
		date: string
		start: string | null
		stop: string | null
		schedule: string[]
	}
	userSchedules: {
		closed: {
			ditch: number
			hours: number | null
			schedule: string[]
		}[]
	}
	user: {
		id: string
		display: string | null
	}
}) {
	return (
		<Card className="bg-muted">
			<CardHeader className="flex-col items-center">
				<CardTitle>Schedule Dated: {closed.date}</CardTitle>
				{closed.start && closed.stop ? <CardDescription>{closed.schedule.join(' ─ ')}</CardDescription> : null}
			</CardHeader>
			<CardContent className="flex-col gap-2">
				{userSchedules.closed ? (
					userSchedules.closed.map(userSchedule => (
						<UserScheduleTimeline key={`timeline-${userSchedule.ditch}`} user={user} userSchedule={userSchedule} />
					))
				) : (
					<MissingUserSchedule schedule={userSchedules.closed} />
				)}
			</CardContent>
		</Card>
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

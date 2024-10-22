import { invariantResponse } from '@epic-web/invariant'
import { type LoaderFunctionArgs, json } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { formatDistanceToNow, subDays } from 'date-fns'
import { z } from 'zod'
import { DisplayField } from '#app/components/forms'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon'
import { getUserId } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server.ts'
import { parseMdx } from '#app/utils/mdx-bundler.server'
import { formatDay, formatDates, formatUserSchedule } from '#app/utils/misc'
import AnnouncementsComponent from './_marketing+/announcements'
import { PaymentCancelled } from './payment+/__cancelled-dialog'
import { PaymentsDialog } from './payment+/__continue-dialog'
import { PaymentSuccess } from './payment+/__success-dialog'
import { UserScheduleEditor, action } from './schedule+/__schedule-editor'
import { UserScheduleTimeline } from './schedule+/__schedule-timeline'

export { action }

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
				ports: { select: { id: true, ditch: true } },
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
				port: {
					select: {
						id: true,
						ditch: true,
					},
				},
				hours: true,
				start: true,
				stop: true,
			},
			where: { userId },
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

export default function HomeRoute() {
	const USDollar = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
	const {
		user,
		balance,
		open,
		closed,
		userSchedules,
		payment: { enabled, success, cancelled },
	} = useLoaderData<typeof loader>()
	if (user) {
		return (
			<div className="flex w-full flex-col items-center">
				<h2 className="flex flex-nowrap pt-3 text-3xl font-semibold leading-none tracking-tight">
					Clearwater Farms Unit 1
				</h2>
				<div className="mb-0 text-xl">Irrigation Schedules</div>

				<div
					style={{ width: 'clamp(352px, 75%, 720px)' }}
					className="m-auto mt-2 rounded-md border-2 border-secondary px-3 py-1 text-center align-bottom"
				>
					For website access, questions or comments, please send an email to:
					<br />
					<strong>Ken McGinnis&nbsp;</strong>
					<Icon className="mb-1 mr-1 h-6 w-6 text-blue-700" name="id-card" />
					kenneth.j.mcginnis@gmail.com
				</div>

				{user.restricted ? (
					<div
						style={{ width: 'clamp(352px, 75%, 720px)' }}
						className="m-auto mt-2 flex flex-col rounded-md border-2 border-destructive px-3 py-2"
					>
						<div className="text-center text-xl font-semibold uppercase text-foreground-destructive">
							User Account Restricted
						</div>
						<div className="text-center text-lg text-foreground-destructive">{user.restriction}</div>
					</div>
				) : null}
				{balance !== null ? (
					<div
						style={{ width: 'clamp(352px, 75%, 720px)' }}
						className={`m-auto mt-2 flex flex-col rounded-md border-2 ${balance < 0 ? 'border-destructive' : 'border-green-900'} px-3 py-2`}
					>
						<div
							className={`flex items-center text-xl font-semibold ${balance < 0 ? 'text-foreground-destructive' : 'text-green-900'}`}
						>
							<div className="w-full text-center">Irrigation Balance: {USDollar.format(balance)}</div>
							{enabled ? (
								<>
									<PaymentsDialog userId={user.id} stripeId={user.stripeId} balance={balance} />
									<PaymentSuccess open={success} username={user.username} />
									<PaymentCancelled open={cancelled} username={user.username} />
								</>
							) : null}
						</div>
					</div>
				) : null}
				<Link
					to="/irrigation"
					style={{ width: 'clamp(352px, 75%, 720px)' }}
					className="border-1 my-1 flex justify-center rounded-lg border-secondary-foreground bg-sky-800 p-2 text-xl text-white"
				>
					<Icon name="droplets" className="mx-1 h-8 w-8 p-1" aria-hidden="true" />
					Where is the water currently?
					<Icon name="droplet" className="mx-1 h-8 w-8 p-1" aria-hidden="true" />
				</Link>
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
			port: {
				id: string
				ditch: number
			}
			hours: number | null
			previous: number | null
		}[]
	}
	user: {
		id: string
		display: string | null
		defaultHours: number
		restricted: boolean | null
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
							key={`schedule-${userSchedule.port.ditch}`}
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
			port: {
				id: string
				ditch: number
			}
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
			<CardContent className="flex-col">
				{userSchedules.closed ? (
					userSchedules.closed.map(userSchedule => (
						<UserScheduleTimeline key={`timeline-${userSchedule.port.ditch}`} user={user} userSchedule={userSchedule} />
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

import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Button } from '#app/components/ui/button'
import { Icon } from '#app/components/ui/icon'
import { Separator } from '#app/components/ui/separator'
import { prisma } from '#app/utils/db.server.ts'
import { formatDates, formatHours } from '#app/utils/misc'
import { useOptionalAdminUser } from '#app/utils/user'

type TotalType = { [key: number]: { hours: number; irrigators: number } }
type PositionDitchType = {
	// page - for <table>
	[key: string]: {
		// position - for <tr>
		[key: string]: {
			// ditch - for <td>
			[key: string]: UserType
		}
	}
}
type UserType = {
	id: string
	display: string
	ditch: number
	position: number
	hours: number | bigint | null
	start: Date | string | null
	stop: Date | string | null
	schedule: string[]
}

const SearchResultsSchema = z.array(
	z.object({
		id: z.string(),
		display: z.string(),
		ditch: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(9)),
		position: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(99)),
		hours: z.preprocess(x => (x ? x : 0), z.coerce.number().multipleOf(0.5).min(0).max(36)),
		start: z.date().nullable(),
		stop: z.date().nullable(),
	}),
)

export async function loader({ params }: LoaderFunctionArgs) {
	invariantResponse(params.date, 'Date parameter Not found', { status: 404 })

	const schedule = await prisma.schedule.findFirst({
		select: { id: true, state: true },
		where: { date: params.date },
	})
	invariantResponse(schedule?.id, 'Schedule Not found', { status: 404 })

	const rawUsers = await prisma.$queryRaw`
		SELECT User.id, User.display, Port.ditch, Port.position, mid.hours, mid.start, mid.stop
		FROM User
		INNER JOIN Port ON User.id = Port.userId
    LEFT JOIN (
      SELECT UserSchedule.userId, UserSchedule.ditch, UserSchedule.hours, UserSchedule.start, UserSchedule.stop
      FROM Schedule 
      INNER JOIN UserSchedule ON Schedule.id = UserSchedule.scheduleId
      WHERE Schedule.id = ${schedule?.id}
    ) mid
		ON User.id = mid.userId
		AND Port.ditch = mid.ditch
		WHERE User.active
		ORDER BY Port.ditch, Port.position
	`

	const result = SearchResultsSchema.safeParse(rawUsers)
	if (!result.success) {
		return json(
			{
				status: 'error',
				error: result.error.message,
				schedule: { id: null, date: null, state: null },
				users: null,
				totals: null,
				rows: null,
				cols: null,
			} as const,
			{ status: 400 },
		)
	}

	const page = (ditch: number): number => Math.ceil(ditch / 2)

	const ditchTotals: TotalType = {}
	const users: PositionDitchType = {}
	for (let user of result.data) {
		// user groupings
		const { start, stop, ditch, position, hours } = user
		const pageNumber = page(ditch)
		const leftOrRight = ditch % 2 ? 'left' : 'right'
		const userType = { ...user, schedule: formatDates({ start, stop }) }
		if (!users[pageNumber]) users[pageNumber] = { [position]: { [leftOrRight]: userType } }
		if (!users[pageNumber][position]) users[pageNumber][position] = { [leftOrRight]: userType }
		else users[pageNumber][position][leftOrRight] = userType

		// ditch totals
		if (!ditchTotals[ditch]) ditchTotals[ditch] = { hours: 0, irrigators: 0 }
		if (hours) {
			ditchTotals[ditch].hours += hours
			ditchTotals[ditch].irrigators += 1
		}
	}
	return json({
		status: 'idle',
		schedule: { id: schedule.id, date: params.date, state: schedule.state },
		users,
		ditchTotals,
	} as const)
}

export default function PrintableTimelineRoute() {
	const userIsAdmin = useOptionalAdminUser()
	const data = useLoaderData<typeof loader>()
	const { status, schedule, users } = data
	const { id: scheduleId, date: scheduleDate } = schedule

	if (status !== 'idle' || !scheduleId || !users || !Object.keys(users).length) return null

	return (
		<div className="text-align-webkit-center flex w-full flex-col items-center justify-center gap-1 bg-background">
			<div className="flex w-[90%] flex-row-reverse flex-wrap gap-2 p-0.5">
				{userIsAdmin ? (
					<Button>
						<Link reloadDocument to={`/resources/download-print/${scheduleDate}`}>
							<Icon name="download">Download</Icon>
						</Link>
					</Button>
				) : null}
			</div>
			<div className="text-align-webkit-center flex w-full flex-col items-center justify-center gap-1 bg-background">
				<main className="m-auto w-[90%]" style={{ height: 'fill-available' }}>
					{Object.keys(users).map(page => (
						<div key={`${page}`} className="m-auto block overflow-x-auto overflow-y-auto">
							<table className="w-[80%]">
								<thead>
									<tr>
										<td className="text-center text-body-lg">Ditch {Number(page) * 2 - 1}</td>
										<td className="text-center text-body-lg">
											{Number(page) < 5 ? `Ditch ${Number(page) * 2}` : null}
										</td>
									</tr>
								</thead>
								{Object.keys(users[page]).map(position => {
									const { left, right } = users[page][position]
									return (
										<tr className="w-[100%]" key={`${position}`}>
											<td className="w-[50%] p-0.5">
												{left ? <UserCard scheduleDate={scheduleDate} user={left} /> : null}
											</td>
											<td className="w-[50%] p-0.5">
												{right ? <UserCard scheduleDate={scheduleDate} user={right} /> : null}
											</td>
										</tr>
									)
								})}
							</table>
							<Separator className="mb-8 mt-4" />
						</div>
					))}
				</main>
			</div>
		</div>
	)
}

function UserCard({ scheduleDate, user }: { scheduleDate: string; user: UserType }) {
	return (
		<Link
			to={`/timeline/${scheduleDate}/${user.display}`}
			className={`flex rounded-lg ${user.hours ? 'bg-muted' : 'bg-muted-40'} p-2`}
		>
			<div className="flex w-full flex-row justify-between gap-1">
				<span className="overflow-hidden text-ellipsis text-nowrap text-left text-body-sm text-muted-foreground">
					{user.position}: {user.display}
				</span>
				<span className="overflow-hidden text-ellipsis text-nowrap text-right text-body-sm text-muted-foreground">
					{formatHours(Number(user.hours))}
				</span>
				{user.schedule.map((row, r) => (
					<span
						key={`row-${r}`}
						className="overflow-hidden text-ellipsis text-right text-body-sm text-muted-foreground"
					>
						{row}
					</span>
				))}
			</div>
		</Link>
	)
}

export const meta: MetaFunction<null, { 'routes/schedule+/$date/timeline': typeof loader }> = ({ params }) => {
	return [
		{ title: `Irrigation Timeline | ${params.date}` },
		{
			name: 'description',
			content: `Clearwater Farms 1 Irrigation Timeline`,
		},
	]
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
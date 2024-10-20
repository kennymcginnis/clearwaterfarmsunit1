import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { useState } from 'react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Badge } from '#app/components/ui/badge'
import { Button } from '#app/components/ui/button'
import { Icon } from '#app/components/ui/icon'
import { Separator } from '#app/components/ui/separator'
import { prisma } from '#app/utils/db.server.ts'
import { formatDates, formatHrs } from '#app/utils/misc'
import { useOptionalUser } from '#app/utils/user'
import { backgroundColor, borderColor, SearchResultsSchema, type UserScheduleType } from '#app/utils/user-schedule.ts'

type TotalType = { [key: number]: { hours: number; irrigators: number } }
type PositionDitchType = {
	// page - for <table>
	[key: string]: {
		// section - for <tr dotted>
		[key: string]: {
			// position - for <tr>
			[key: string]: {
				// entry - for <td>
				[key: string]: UserScheduleType
			}
		}
	}
}

export async function loader({ params }: LoaderFunctionArgs) {
	invariantResponse(params.date, 'Date parameter Not found', { status: 404 })

	const schedule = await prisma.schedule.findFirst({ select: { id: true, state: true }, where: { date: params.date } })
	invariantResponse(schedule?.id, 'Schedule Not found', { status: 404 })

	const rawUsers = await prisma.$queryRaw`
		SELECT User.id AS userId, User.display, 
					 Port.id AS portId, Port.ditch, Port.position, Port.entry, Port.section, 
					 UserSchedule.hours, UserSchedule.start, UserSchedule.stop,
					 UserSchedule.first, UserSchedule.crossover, UserSchedule.last
			FROM User
		 INNER JOIN Port ON User.id = Port.userId
		  LEFT JOIN UserSchedule
		    ON User.id = UserSchedule.userId
		   AND Port.id = UserSchedule.portId
		   AND UserSchedule.scheduleId = ${schedule.id}
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

	const cell = (ditch: number, position: number) => {
		if (ditch < 5) return { page: ditch, row: position }
		if (ditch < 9) return { page: ditch - 4, row: position }
		return { page: 0, row: position < 15 ? position : position - 14 }
	}

	// page0.West.5.['10-01'].hours
	// page1.North.7.['10-03'].hours
	const groupped: PositionDitchType = {
		'0': { West: {}, East: {} },
		'1': { North: {}, South: {} },
		'2': { North: {}, South: {} },
		'3': { North: {}, South: {} },
		'4': { North: {}, South: {} },
	}

	const ditchTotals: TotalType = {}
	for (let user of result.data) {
		// user groupings
		const { hours, start, stop, ditch, position, entry, section } = user
		const { page, row } = cell(ditch, position)
		const userType = { ...user, schedule: formatDates({ start, stop }) }
		if (!groupped[page][section][row]) groupped[page][section][row] = { [entry]: userType }
		else groupped[page][section][row][entry] = userType
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
		users: groupped,
		ditchTotals,
	} as const)
}

export default function TimelineRoute() {
	const user = useOptionalUser()
	const userIsAdmin = user?.roles.some(r => r.name === 'admin')
	const defaultUserEntry = user?.ports[0].entry
	const data = useLoaderData<typeof loader>()
	const { status, schedule, users } = data
	const { id: scheduleId, date: scheduleDate } = schedule

	if (status !== 'idle' || !scheduleId || !users || !Object.keys(users).length) return null

	return (
		<div className="text-align-webkit-center flex w-full flex-col items-center justify-center gap-1 bg-background">
			<div className="flex w-[90%] flex-row-reverse flex-wrap gap-2 p-0.5">
				{userIsAdmin ? (
					<Button>
						<Link reloadDocument to={`/resources/download/print/${scheduleDate}`}>
							<Icon name="download">Download</Icon>
						</Link>
					</Button>
				) : null}
			</div>
			<div className="text-align-webkit-center flex w-full flex-col items-center justify-center gap-1 bg-background">
				<main className="m-auto w-[90%]" style={{ height: 'fill-available' }}>
					<OneColumn users={users} defaultUserEntry={defaultUserEntry} />
					<TwoColumns users={users} />
				</main>
			</div>
		</div>
	)
}

function OneColumn({ users, defaultUserEntry }: { users: PositionDitchType; defaultUserEntry?: string | null }) {
	const [visible, setVisible] = useState(defaultUserEntry ?? '10-01')
	const handleToggleVisible = (value: string) => setVisible(value)
	return (
		<div className="m-auto block md:hidden">
			<div className="flex w-full flex-row justify-center">
				<Button
					variant="outline-link"
					className={`mx-0.5 my-1 ${visible === '10-01' && 'bg-secondary underline underline-offset-4'}`}
					onClick={() => handleToggleVisible('10-01')}
				>
					[10-01] (Ditches 1-4)
				</Button>
				<Button
					variant="outline-link"
					className={`mx-0.5 my-1 ${visible === '10-03' && 'bg-secondary underline underline-offset-4'}`}
					onClick={() => handleToggleVisible('10-03')}
				>
					[10-03] (Ditches 5-8)
				</Button>
			</div>
			<div className="flex w-full flex-row justify-center">
				{Array.from({ length: 4 }, (_, i) => i + (visible === '10-01' ? 1 : 5)).map(i => (
					<Button variant="outline-link" key={`#jump${i}`} asChild className="mx-0.5 my-1">
						<Link to={`#d${i}`}>Ditch {i}</Link>
					</Button>
				))}
			</div>
			{Object.keys(users).map(page => (
				<>
					<div id={`d${page === '0' ? 9 : Number(page)}`}></div>
					<div id={`d${page === '0' ? 9 : Number(page) + 4}`}></div>
					<table className="w-full table-fixed lg:w-[80%]">
						<thead>
							<tr>
								<th className="rounded-md bg-primary text-center text-body-lg text-secondary">
									{`[${visible}] Ditch ${page === '0' ? 9 : Number(page) + (visible === '10-01' ? 0 : 4)}`}
								</th>
							</tr>
						</thead>
						{Object.keys(users[page]).map((section, index) => (
							<>
								{Object.keys(users[page][section]).map(row => {
									const user = users[page][section][row][visible]
									return (
										<tr className="w-full" key={`${row}`}>
											<td className="w-[50%] p-0.5">{user ? <UserCard user={user} /> : null}</td>
										</tr>
									)
								})}
								{index === 0 ? (
									<tr>
										<td className="border-t-2 border-dashed border-sky-950" key={`${page}-${visible}-${section}`}></td>
									</tr>
								) : null}
							</>
						))}
					</table>
					<Separator className="mb-8 mt-4" />
				</>
			))}
		</div>
	)
}

function TwoColumns({ users }: { users: PositionDitchType }) {
	return (
		<div className="m-auto block max-md:hidden">
			{Array.from({ length: 8 }, (_, i) => i + 1).map(i => (
				<Button variant="outline-link" key={`#jump${i}`} asChild className="mx-0.5 my-1">
					<Link to={`#ditch${i}`}>Ditch {i}</Link>
				</Button>
			))}
			{Object.keys(users).map(page => (
				<div key={`${page}`} className="m-auto block max-md:hidden">
					<div id={`ditch${page === '0' ? 9 : Number(page)}`}></div>
					<div id={`ditch${page === '0' ? 9 : Number(page) + 4}`}></div>
					<table className="w-full table-fixed lg:w-[80%]">
						<thead>
							<tr>
								<th className="rounded-md bg-primary text-center text-body-lg text-secondary">
									[10-01] Ditch {page === '0' ? 9 : Number(page)}
								</th>
								<th className="rounded-md bg-primary text-center text-body-lg text-secondary">
									[10-03] Ditch {page === '0' ? 9 : Number(page) + 4}
								</th>
							</tr>
						</thead>
						{Object.keys(users[page]).map((section, index) => (
							<>
								{Object.keys(users[page][section]).map(row => {
									const left = users[page][section][row]['10-01']
									const right = users[page][section][row]['10-03']
									return (
										<tr className="w-full" key={`${row}`}>
											<td className="w-[50%] p-0.5">{left ? <UserCard user={left} /> : null}</td>
											<td className="w-[50%] p-0.5">{right ? <UserCard user={right} /> : null}</td>
										</tr>
									)
								})}
								{index === 0 ? (
									<tr>
										<td className="border-t-2 border-dashed border-sky-950" key={`${page}-10-01-${section}`}></td>
										<td className="border-t-2 border-dashed border-sky-950" key={`${page}-10-03-${section}`}></td>
									</tr>
								) : null}
							</>
						))}
					</table>
					<Separator className="mb-8 mt-4" />
				</div>
			))}
		</div>
	)
}

function UserCard({
	user: { display, hours, position, schedule, first, crossover, last },
}: {
	user: UserScheduleType
}) {
	return (
		<div
			className={`flex rounded-lg ${hours ? 'border-1 border-secondary-foreground bg-muted' : 'bg-muted-40'} p-2 ${borderColor({ first, crossover, last })}`}
		>
			<div className={`grid w-full grid-cols-10 justify-between gap-1`}>
				<span className="col-span-2 overflow-hidden text-ellipsis text-nowrap text-left text-body-sm">
					{position}: {display}
				</span>
				<span className="col-span-1 text-nowrap text-right text-body-sm">{formatHrs(Number(hours))}</span>
				{schedule &&
					schedule.map((row, r) => (
						<span key={`row-${r}`} className="col-span-3 overflow-hidden text-ellipsis text-right text-body-sm">
							{row}
						</span>
					))}
				<div className="col-span-1 flex flex-col items-start gap-1">
					{first && (
						<Badge className={`ml-2 capitalize ${backgroundColor('first')}`} variant="outline">
							{'First'}
						</Badge>
					)}
					{crossover && (
						<Badge className={`ml-2 capitalize ${backgroundColor('crossover')}`} variant="outline">
							{'Crossover'}
						</Badge>
					)}
					{last && (
						<Badge className={`ml-2 capitalize ${backgroundColor('last')}`} variant="outline">
							{'Last'}
						</Badge>
					)}
				</div>
			</div>
		</div>
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

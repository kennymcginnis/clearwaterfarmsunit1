import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { useState } from 'react'
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
		// section - for <tr dotted>
		[key: string]: {
			// position - for <tr>
			[key: string]: {
				// entry - for <td>
				[key: string]: UserType
			}
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
	first?: boolean
}
type FirstDitchType = {
	// ditch
	[key: string]: {
		// entry - for <td>
		[key: string]: {
			// section
			[key: string]: boolean
		}
	}
}

const SearchResultsSchema = z.array(
	z.object({
		id: z.string(),
		display: z.string(),
		ditch: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(9)),
		position: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(99)),
		entry: z.string(),
		section: z.string(),
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
		SELECT User.id, User.display, 
					 Port.ditch, Port.position, Port.entry, Port.section, 
					 mid.hours, mid.start, mid.stop
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

	const cell = (ditch: number, position: number) => {
		if (ditch < 5) return { page: ditch, row: position }
		if (ditch < 9) return { page: ditch - 4, row: position }
		return { page: 0, row: position < 15 ? position : position - 14 }
	}

	const firsts: FirstDitchType = {
		'1': { '10-01': { North: false, South: false } },
		'2': { '10-01': { North: false, South: false } },
		'3': { '10-01': { North: false, South: false } },
		'4': { '10-01': { North: false, South: false } },
		'5': { '10-03': { North: false, South: false } },
		'6': { '10-03': { North: false, South: false } },
		'7': { '10-03': { North: false, South: false } },
		'8': { '10-03': { North: false, South: false } },
		'9': { '10-01': { West: false, East: false }, '10-03': { West: false, East: false } },
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

			if (!firsts[ditch][entry][section]) {
				groupped[page][section][row][entry].first = true
				firsts[ditch][entry][section] = true
			}
		}
	}
	return json({
		status: 'idle',
		schedule: { id: schedule.id, date: params.date, state: schedule.state },
		users: groupped,
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
						<Link reloadDocument to={`/resources/download/print/${scheduleDate}`}>
							<Icon name="download">Download</Icon>
						</Link>
					</Button>
				) : null}
			</div>
			<div className="text-align-webkit-center flex w-full flex-col items-center justify-center gap-1 bg-background">
				<main className="m-auto w-[90%]" style={{ height: 'fill-available' }}>
					<OneColumn users={users} scheduleDate={scheduleDate} />
					<TwoColumns users={users} scheduleDate={scheduleDate} />
				</main>
			</div>
		</div>
	)
}

function OneColumn({ users, scheduleDate }: { users: PositionDitchType; scheduleDate: string }) {
	const [visible, setVisible] = useState('10-01')
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
											<td className="w-[50%] p-0.5">
												{user ? <UserCard scheduleDate={scheduleDate} user={user} /> : null}
											</td>
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

function TwoColumns({ users, scheduleDate }: { users: PositionDitchType; scheduleDate: string }) {
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
											<td className="w-[50%] p-0.5">
												{left ? <UserCard scheduleDate={scheduleDate} user={left} /> : null}
											</td>
											<td className="w-[50%] p-0.5">
												{right ? <UserCard scheduleDate={scheduleDate} user={right} /> : null}
											</td>
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
	scheduleDate,
	user: { display, hours, position, schedule, first },
}: {
	scheduleDate: string
	user: UserType
}) {
	return (
		<Link
			to={`/timeline/${scheduleDate}/${display}`}
			className={`flex rounded-lg ${hours ? (first ? 'bg-secondary' : 'bg-muted') : 'bg-muted-40'} ${first && 'border-1 border-secondary-foreground'} p-2`}
		>
			<div className={`flex w-full flex-row justify-between gap-1`}>
				<span className="w-[30%] overflow-hidden text-ellipsis text-nowrap text-left text-body-sm text-muted-foreground">
					{position}: {display}
				</span>
				<span className="w-[10%] overflow-hidden text-ellipsis text-nowrap text-right text-body-sm text-muted-foreground">
					{formatHours(Number(hours))}
				</span>
				{schedule.map((row, r) => (
					<span
						key={`row-${r}`}
						className="w-[30%] overflow-hidden text-ellipsis text-right text-body-sm text-muted-foreground"
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

import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs, json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node'
import { Form, Link, useLoaderData, useSubmit } from '@remix-run/react'
import { add, parseISO } from 'date-fns'
import { useState } from 'react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Button } from '#app/components/ui/button'
import { prisma } from '#app/utils/db.server.ts'
import { formatDates, formatHours } from '#app/utils/misc'
import { requireUserWithRole } from '#app/utils/permissions.ts'
import { generatePublicId } from '#app/utils/public-id'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { useOptionalAdminUser } from '#app/utils/user'

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
	userId: string
	display: string | null
	ditch: number
	position: number
	hours: number | bigint | null
	start: Date | string | null
	stop: Date | string | null
	schedule: string[]
	first?: boolean
}
type SidesType = { begins: Date; ends: Date; hours: number; irrigators: number; [key: string]: Date | number }
type TimelinesType = { '10-01': SidesType; '10-03': SidesType; [key: string]: SidesType }
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
		userId: z.string(),
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
export async function loader({ request, params }: LoaderFunctionArgs) {
	const userId = await requireUserWithRole(request, 'admin')
	const { date } = params
	invariantResponse(date, 'Date parameter Not found', { status: 404 })

	const schedule = await prisma.schedule.findFirst({ select: { id: true, state: true }, where: { date } })
	invariantResponse(schedule?.id, 'Schedule Not found', { status: 404 })

	let timeline = await prisma.timeline.findMany({ where: { date }, orderBy: { order: 'asc' } })

	if (timeline.length) {
		// await prisma.timeline.deleteMany()
	} else {
		const rawUsers = await prisma.$queryRaw`
			SELECT User.id AS userId, User.display, 
	  				 Port.ditch, Port.position, Port.entry, Port.section, 
	  				 UserSchedule.hours, UserSchedule.start, UserSchedule.stop
	  		FROM User
	  	 INNER JOIN Port ON User.id = Port.userId
	  	  LEFT JOIN UserSchedule
	  	    ON User.id = UserSchedule.userId
	  	   AND Port.ditch = UserSchedule.ditch
	  	   AND UserSchedule.scheduleId = ${schedule.id}
	  	 WHERE User.active
	  	 ORDER BY Port.ditch, Port.position
		`

		const result = SearchResultsSchema.safeParse(rawUsers)
		if (!result.success) {
			console.error(result.error.message)
			return json(
				{
					status: 'error',
					error: result.error.message,
					schedule: { id: null, date: null, state: null },
					users: null,
					timelines: null,
				} as const,
				{ status: 400 },
			)
		}

		const sortOrder = (ditch: number, position: number) => {
			if (ditch === 9) return position
			return ditch * 100 + position
		}

		for (let { ditch, position, entry, section, ...member } of result.data) {
			const order = sortOrder(ditch, position)

			await prisma.timeline.create({
				data: {
					id: generatePublicId(),
					scheduleId: schedule.id,
					entry,
					order,
					date,
					ditch,
					position,
					section,
					...member,
					updatedBy: userId,
				},
			})
		}
		timeline = await prisma.timeline.findMany({ where: { date: params.date }, orderBy: { order: 'asc' } })
	}

	const cell = (ditch: number, position: number) => {
		if (ditch < 5) return { page: ditch, row: position }
		if (ditch < 9) return { page: ditch - 4, row: position }
		return { page: 0, row: position < 15 ? position : position - 14 }
	}

	const timelines: TimelinesType = {
		'10-01': {
			begins: new Date(100000000000000),
			ends: new Date(0),
			hours: 0,
			irrigators: 0,
		},
		'10-03': {
			begins: new Date(100000000000000),
			ends: new Date(0),
			hours: 0,
			irrigators: 0,
		},
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
	for (let user of timeline) {
		// user groupings
		const { hours, start, stop, ditch, position, entry, section } = user
		const { page, row } = cell(ditch, position)
		const userType = { ...user, schedule: formatDates({ start, stop }) }
		if (!groupped[page][section][row]) groupped[page][section][row] = { [entry]: userType }
		else groupped[page][section][row][entry] = userType

		if (hours) {
			timelines[entry].hours += hours
			timelines[entry].irrigators += 1

			if (!firsts[ditch][entry][section]) {
				groupped[page][section][row][entry].first = true
				firsts[ditch][entry][section] = true
			}
		}
		if (start && start < timelines[entry].begins) timelines[entry].begins = start
		if (stop && stop > timelines[entry].ends) timelines[entry].ends = stop
	}

	// if not yet calculated, set default start to today
	if (timelines['10-01'].begins.getTime() === new Date(100000000000000).getTime())
		timelines['10-01'].begins = new Date(new Date().toISOString().slice(0, 10))
	if (timelines['10-03'].begins.getTime() === new Date(100000000000000).getTime())
		timelines['10-03'].begins = new Date(new Date().toISOString().slice(0, 10))
	if (timelines['10-01'].ends.getTime() === new Date(0).getTime())
		timelines['10-01'].ends = add(timelines['10-01'].begins, { hours: timelines['10-01'].hours })
	if (timelines['10-03'].ends.getTime() === new Date(0).getTime())
		timelines['10-03'].ends = add(timelines['10-03'].begins, { hours: timelines['10-03'].hours })

	// console.dir({ timelines }, { depth: null })

	return json({
		status: 'idle',
		schedule: { id: schedule.id, date, state: schedule.state },
		users: groupped,
		timelines,
	} as const)
}

export async function action({ request }: ActionFunctionArgs) {
	await requireUserWithRole(request, 'admin')
	const formData = await request.formData()
	const intent = formData.get('intent')
	const entry = formData.get('entry')?.toString()
	const direction = formData.get('direction')?.toString()
	const timestamp = formData.get('timestamp')?.toString()
	const scheduleId = formData.get('scheduleId')?.toString()

	const schedule = await prisma.schedule.findFirst({ select: { date: true }, where: { id: scheduleId } })
	invariantResponse(schedule?.date, 'Schedule Not found', { status: 404 })

	switch (intent) {
		case 'reset': {
			await prisma.timeline.deleteMany({ where: { scheduleId } })
			return redirectWithToast('.', { type: 'success', title: 'Success', description: 'Timeline reset.' })
		}
		case 'update': {
			invariantResponse(timestamp, 'Invalid Timestamp', { status: 400 })
			const dated = parseISO(timestamp)
			invariantResponse(direction, 'Invalid Direction', { status: 400 })
			invariantResponse(entry, 'Invalid Entry', { status: 400 })
			await updateSection({ [direction]: dated, entry })
			return redirectWithToast('.', { type: 'success', title: 'Success', description: 'Timeline updated.' })
		}
		case 'submit': {
			const timeline = await prisma.timeline.findMany({ where: { scheduleId, hours: { gt: 0 } } })
			timeline.forEach(async ({ userId, scheduleId, ditch, start, stop }) => {
				await prisma.userSchedule.update({
					data: { start, stop },
					where: { userId_ditch_scheduleId: { userId, ditch, scheduleId } },
				})
			})

			await prisma.timeline.deleteMany()

			return redirectWithToast(`/schedule/${schedule.date}/timeline`, {
				type: 'success',
				title: 'Success',
				description: 'Timeline Submitted.',
			})
		}
	}

	async function updateSection({ begins, ends, entry }: { begins?: Date; ends?: Date; entry: string }) {
		const timeline = await prisma.timeline.findMany({ where: { scheduleId, entry }, orderBy: { order: 'asc' } })

		if (begins) {
			let start,
				stop = begins
			for (let { id, hours } of timeline) {
				if (hours === 0) continue
				start = stop
				stop = add(start, { hours })
				await prisma.timeline.update({ data: { start, stop }, where: { id } })
			}
		} else if (ends) {
			let start = ends,
				stop
			for (let { id, hours } of timeline.reverse()) {
				if (hours === 0) continue
				stop = start
				start = add(stop, { hours: -hours })
				await prisma.timeline.update({ data: { start, stop }, where: { id } })
			}
		}
	}
}

export default function GenerateTimelineRoute() {
	const submit = useSubmit()
	const userIsAdmin = useOptionalAdminUser()
	const data = useLoaderData<typeof loader>()

	const [showAll, setShowAll] = useState(false)
	const toggleShowAll = () => setShowAll(!showAll)

	const { status, schedule, users, timelines } = data
	const { id: scheduleId, date: scheduleDate } = schedule

	const [timestamps, setTimestamps] = useState(timelines)
	const getTimestamp = (ev: any): string => {
		if (!ev.target['validity'].valid) return ''
		return ev.target['value'] + ':00Z'
	}
	const handleChangeTimestamp = (ev: any, entry: string, direction: string) => {
		const timestamp = getTimestamp(ev)
		const t = { ...timestamps }
		t[entry][direction] = timestamp
		// @ts-ignore:next-line
		setTimestamps(t)
		// console.dir({ scheduleId, entry, direction, timestamp }, { depth: null })
		submit({ intent: 'update', scheduleId, entry, direction, timestamp }, { method: 'post' })
	}

	if (status !== 'idle' || !scheduleId || !users || !Object.keys(users).length) return null

	return (
		<>
			<div className="text-align-webkit-center flex w-full flex-col items-center justify-center bg-background">
				{userIsAdmin ? (
					<>
						<div className="flex w-[70%] flex-row justify-between gap-2 p-0.5">
							<Button variant="outline" onClick={toggleShowAll} className="w-[150px] pb-2">
								Display {showAll ? 'Scheduled' : 'All'}
							</Button>
							<div className="flex flex-row gap-2">
								<Form method="post" encType="multipart/form-data">
									<input type="hidden" name="scheduleId" value={scheduleId} />
									<Button type="submit" name="intent" value="reset" variant="destructive" className="btn btn-sm">
										Reset
									</Button>
								</Form>
								<Form method="post" encType="multipart/form-data">
									<input type="hidden" name="scheduleId" value={scheduleId} />
									<Button type="submit" name="intent" value="submit" variant="secondary" className="btn btn-sm">
										Submit
									</Button>
								</Form>
							</div>
						</div>
						<div className="flex w-[72%] flex-row flex-wrap place-content-center">
							<div className="justify-content-right flex w-[50%] flex-row flex-wrap">
								<div className="min-w-[300px] max-w-[50%] p-2">
									<div className="flex pl-2 text-body-lg font-semibold">Starts:</div>
									<input
										className="float-right w-full rounded-sm bg-secondary p-2 text-body-lg"
										aria-label="Date and time"
										type="datetime-local"
										step="1800"
										value={(timelines['10-01'].begins || '').toString().substring(0, 16)}
										onChange={ev => handleChangeTimestamp(ev, '10-01', 'begins')}
									/>
									<div className="float-left pl-2 text-body-md">Total Hours: {timelines['10-01'].hours}</div>
								</div>
								<div className="min-w-[300px] max-w-[50%] border-r p-2">
									<div className="flex pl-2 text-body-lg font-semibold">Ends:</div>
									<input
										className="float-right w-full rounded-sm bg-secondary p-2 text-body-lg"
										aria-label="Date and time"
										type="datetime-local"
										step="1800"
										value={(timelines['10-01'].ends || '').toString().substring(0, 16)}
										onChange={ev => handleChangeTimestamp(ev, '10-01', 'ends')}
									/>
									<div className="float-left pl-2 text-body-md">Irrigators: {timelines['10-01'].irrigators}</div>
								</div>
							</div>
							<div className="flex w-[50%] flex-row flex-wrap">
								<div className="min-w-[300px] max-w-[50%] border-l p-2">
									<div className="flex pl-2 text-body-lg font-semibold">Starts:</div>
									<input
										className="float-right w-full rounded-sm bg-secondary p-2 text-body-lg"
										aria-label="Date and time"
										type="datetime-local"
										step="1800"
										value={(timelines['10-03'].begins || '').toString().substring(0, 16)}
										onChange={ev => handleChangeTimestamp(ev, '10-03', 'begins')}
									/>
									<div className="float-left pl-2 text-body-md">Total Hours: {timelines['10-03'].hours}</div>
								</div>
								<div className="min-w-[300px] max-w-[50%] p-2">
									<div className="flex pl-2 text-body-lg font-semibold">Ends:</div>
									<input
										className="float-right w-full rounded-sm bg-secondary p-2 text-body-lg"
										aria-label="Date and time"
										type="datetime-local"
										step="1800"
										value={(timelines['10-03'].ends || '').toString().substring(0, 16)}
										onChange={ev => handleChangeTimestamp(ev, '10-03', 'ends')}
									/>
									<div className="float-left pl-2 text-body-md">Irrigators: {timelines['10-03'].irrigators}</div>
								</div>
							</div>
						</div>
					</>
				) : null}
				<div className="text-align-webkit-center flex w-full flex-col items-center justify-center gap-1 bg-background">
					<main className="m-auto w-[90%]" style={{ height: 'fill-available' }}>
						{Object.keys(users).map(page => (
							<div key={`${page}`} className="m-auto block overflow-x-auto overflow-y-auto">
								<table className="w-[80%] border-t-2">
									<thead>
										<tr>
											<td className="border-r border-t-2 pb-2 pt-4 text-center text-body-lg">
												Ditch {page === '0' ? 9 : Number(page)}
											</td>
											<td className="border-l border-t-2 pb-2 pt-4 text-center text-body-lg">
												Ditch {page === '0' ? 9 : Number(page) + 4}
											</td>
										</tr>
									</thead>
									{Object.keys(users[page]).map((section, index) => (
										<>
											{Object.keys(users[page][section]).map(row => {
												const left = users[page][section][row]['10-01']
												const right = users[page][section][row]['10-03']
												return (
													<tr className="w-[100%]" key={`${row}`}>
														<td className="w-[50%] border-r px-1 py-0.5">
															{left && (left.hours || showAll) ? (
																<UserCard scheduleDate={scheduleDate} user={left} />
															) : (
																<div></div>
															)}
														</td>
														<td className="w-[50%] border-l px-1 py-0.5">
															{right && (right.hours || showAll) ? (
																<UserCard scheduleDate={scheduleDate} user={right} />
															) : (
																<div></div>
															)}
														</td>
													</tr>
												)
											})}
											{index === 0 ? (
												<tr>
													<td className="border-t-2 border-dashed" key={`${page}-10-01-${section}`}></td>
													<td className="border-t-2 border-dashed" key={`${page}-10-03-${section}`}></td>
												</tr>
											) : null}
										</>
									))}
								</table>
							</div>
						))}
					</main>
				</div>
			</div>
		</>
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
			className={`flex rounded-lg ${hours ? 'bg-muted' : 'bg-muted-40'} ${first && 'border-1 border-secondary-foreground'} p-2`}
		>
			<div className="flex w-full flex-row justify-between gap-1">
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

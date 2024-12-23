import { invariantResponse } from '@epic-web/invariant'
import { type Prisma } from '@prisma/client'
import { type ActionFunctionArgs, json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node'
import { Form, useLoaderData, useSubmit } from '@remix-run/react'
import { add, parseISO } from 'date-fns'
import { useState } from 'react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Badge } from '#app/components/ui/badge'
import { Button } from '#app/components/ui/button'
import { prisma } from '#app/utils/db.server.ts'
import { formatDates, formatHrs } from '#app/utils/misc'
import { requireUserWithRole } from '#app/utils/permissions.ts'
import { generatePublicId } from '#app/utils/public-id'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { useOptionalAdminUser } from '#app/utils/user'
import {
	assignChargesToSchedules,
	backgroundColor,
	borderColor,
	SearchResultsSchema,
	type UserScheduleType,
} from '#app/utils/user-schedule.ts'

type SidesType = { begins: Date; ends: Date; hours: number; irrigators: number; [key: string]: Date | number }
type TimelinesType = { '10-01': SidesType; '10-03': SidesType; [key: string]: SidesType }
export async function loader({ request, params }: LoaderFunctionArgs) {
	const userId = await requireUserWithRole(request, 'admin')
	invariantResponse(params.date, 'Date parameter Not found', { status: 404 })

	const schedule = await prisma.schedule.findFirst({ select: { id: true, state: true }, where: { date: params.date } })
	invariantResponse(schedule?.id, 'Schedule Not found', { status: 404 })

	let timeline = await prisma.timeline.findMany({ where: { date: params.date }, orderBy: { order: 'asc' } })

	if (timeline.length) {
		// await prisma.timeline.deleteMany()
	} else {
		const rawUsers = await prisma.$queryRaw`
			SELECT User.id AS userId, User.display, 
						 Port.id AS portId, Port.ditch, Port.position, Port.entry, Port.section, Port.address, 
	  				 UserSchedule.hours, UserSchedule.start, UserSchedule.stop
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

		const updated: UserScheduleType[] = assignChargesToSchedules(result.data)

		for (let { schedule: ignored, ditch, position, hours, ...updates } of updated) {
			const ordered = sortOrder(ditch, position)

			if (hours) {
				const data: Prisma.TimelineCreateInput = {
					...updates,
					id: generatePublicId(),
					scheduleId: schedule.id,
					hours: Number(hours),
					order: ordered,
					date: params.date,
					ditch,
					position,
					updatedBy: userId,
				}
				await prisma.timeline.create({ data })
			}
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

	// page0.West.5.['10-01'].hours
	// page1.North.7.['10-03'].hours
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
		schedule: { id: schedule.id, date: params.date, state: schedule.state },
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
			timeline.forEach(async ({ userId, scheduleId, portId, start, stop, first, crossover, last }) => {
				try {
					await prisma.userSchedule.update({
						data: { start, stop, first, crossover, last },
						where: { userId_scheduleId_portId: { userId, scheduleId, portId } },
					})
				} catch (error) {
					console.error(error)
				}
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
	const { id: scheduleId } = schedule

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
									<div className="flex pl-2 text-body-lg font-semibold">[10-01] Starts:</div>
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
									<div className="flex pl-2 text-body-lg font-semibold">[10-03] Ends:</div>
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
															{left && (left.hours || showAll) ? <UserCard user={left} /> : <div></div>}
														</td>
														<td className="w-[50%] border-l px-1 py-0.5">
															{right && (right.hours || showAll) ? <UserCard user={right} /> : <div></div>}
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
	user: { display, hours, position, schedule, first, crossover, last },
}: {
	user: UserScheduleType
}) {
	return (
		<div
			className={`flex rounded-lg ${hours ? 'border-1 border-secondary-foreground bg-muted' : 'bg-muted-40'} p-2 ${borderColor({ first, crossover, last })}`}
		>
			<div className="grid w-full grid-cols-10 justify-between gap-1">
				<span className="col-span-2 overflow-hidden text-ellipsis text-nowrap text-left text-body-sm">
					{position}: {display}
				</span>
				<span className="col-span-1 overflow-hidden text-ellipsis text-nowrap text-right text-body-sm">
					{formatHrs(Number(hours))}
				</span>
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

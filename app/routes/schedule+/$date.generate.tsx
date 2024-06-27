import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs, json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node'
import { Form, Link, useLoaderData, useSubmit } from '@remix-run/react'
import { add, parseISO } from 'date-fns'
import { useState } from 'react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Button } from '#app/components/ui/button'
import { Separator } from '#app/components/ui/separator'
import { prisma } from '#app/utils/db.server.ts'
import { formatDates, formatHours } from '#app/utils/misc'
import { requireUserWithRole } from '#app/utils/permissions.ts'
import { generatePublicId } from '#app/utils/public-id'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { useOptionalAdminUser } from '#app/utils/user'

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
	userId: string
	display: string | null
	ditch: number
	position: number
	hours: number | bigint | null
	start: Date | string | null
	stop: Date | string | null
	schedule: string[]
}
const SearchResultsSchema = z.array(
	z.object({
		userId: z.string(),
		display: z.string(),
		ditch: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(9)),
		position: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(99)),
		section: z.string().nullable(),
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

	let timeline = await prisma.timeline.findMany({ where: { date } })

	if (timeline.length) {
		// await prisma.timeline.deleteMany()
	} else {
		const rawUsers = await prisma.$queryRaw`
			SELECT User.id AS userId, User.display, Port.ditch, Port.position, Port.section, mid.hours, mid.start, mid.stop
			FROM User
			INNER JOIN Port ON User.id = Port.userId
			LEFT JOIN (
				SELECT UserSchedule.userId, UserSchedule.ditch, UserSchedule.hours, UserSchedule.start, UserSchedule.stop
				FROM Schedule
				INNER JOIN UserSchedule ON Schedule.id = UserSchedule.scheduleId
				WHERE Schedule.date = ${date}
			) mid
			ON User.id = mid.userId
			AND Port.ditch = mid.ditch
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
					sideMinimum: null,
					ditchTotals: null,
				} as const,
				{ status: 400 },
			)
		}

		const leftOrRight = (ditch: number, section: string | null) => {
			if (ditch < 5) return 'left'
			if (ditch < 9) return 'right'
			return section === 'West' ? 'left' : 'right'
		}

		const calcOrder = (ditch: number, position: number) => {
			if (ditch === 9) return position
			return ditch * 100 + position
		}

		for (let { ditch, position, section, ...member } of result.data) {
			const side = leftOrRight(ditch, section)
			const order = calcOrder(ditch, position)

			await prisma.timeline.create({
				data: {
					id: generatePublicId(),
					scheduleId: schedule.id,
					side,
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
		timeline = await prisma.timeline.findMany({ where: { date: params.date } })
	}

	type SideSortType = { [key: string]: UserType[][]; left: UserType[][]; right: UserType[][] }
	const sorted: SideSortType = { left: new Array(9).fill([]), right: new Array(9).fill([]) }

	const cell = (ditch: number, position: number, section: string | null) => {
		if (ditch < 5) return { page: ditch, row: position, side: 'left' }
		if (ditch < 9) return { page: ditch - 4, row: position, side: 'right' }
		return { page: 0, row: position < 15 ? position : position - 14, side: section === 'West' ? 'left' : 'right' }
	}

	const ditchTotals: { [key: number]: { hours: number; irrigators: number } } = {}
	const sideMinimum: { left: Date; right: Date; [key: string]: Date } = {
		left: new Date(100000000000000),
		right: new Date(100000000000000),
	}
	const paged: PositionDitchType = { '0': {}, '1': {}, '2': {}, '3': {}, '4': {} }
	for (let user of timeline) {
		// user groupings
		const { start, stop, ditch, position, section, hours } = user
		const { page, row, side } = cell(ditch, position, section)
		const userType = { ...user, schedule: formatDates({ start, stop }) }
		if (!paged[page][row]) paged[page][row] = { [side]: userType }
		else paged[page][row][side] = userType

		// users sorted
		sorted[side][page][row] = userType

		// ditch totals
		if (!ditchTotals[ditch]) ditchTotals[ditch] = { hours: 0, irrigators: 0 }
		if (hours) {
			ditchTotals[ditch].hours += hours
			ditchTotals[ditch].irrigators += 1
		}

		if (start && start < sideMinimum[side]) sideMinimum[side] = start
	}

	if (sideMinimum.left.getTime() === new Date(100000000000000).getTime())
		sideMinimum.left = new Date(new Date().toISOString().slice(0, 10))
	if (sideMinimum.right.getTime() === new Date(100000000000000).getTime())
		sideMinimum.right = new Date(new Date().toISOString().slice(0, 10))

	return json({
		status: 'idle',
		schedule: { id: schedule.id, date, state: schedule.state },
		users: paged,
		sideMinimum,
		ditchTotals,
	} as const)
}

export async function action({ request, params }: ActionFunctionArgs) {
	const currentUser = await requireUserWithRole(request, 'admin')
	const formData = await request.formData()
	const intent = formData.get('intent')
	const beginning = formData.get('begin')?.toString()
	switch (intent) {
		case 'reset': {
			const scheduleId = formData.get('scheduleId')?.toString()
			await prisma.timeline.deleteMany({ where: { scheduleId } })
			break
		}
		case 'update-left': {
			invariantResponse(beginning, 'Invalid Start Time', { status: 400 })
			const begins = parseISO(beginning)
			await updateSection(begins, 'left')
			break
		}
		case 'update-right': {
			invariantResponse(beginning, 'Invalid Start Time', { status: 400 })
			const begins = parseISO(beginning)
			await updateSection(begins, 'right')
			break
		}
		case 'submit': {
			const scheduleId = formData.get('scheduleId')?.toString()
			const timeline = await prisma.timeline.findMany({ where: { scheduleId } })
			timeline.forEach(async ({ userId, scheduleId, ditch, start, stop }) => {
				await prisma.userSchedule.update({
					where: { userId_ditch_scheduleId: { userId, ditch, scheduleId } },
					data: { start, stop, updatedBy: currentUser },
				})
			})
			break
		}
	}
	return redirectWithToast('.', { type: 'success', title: 'Success', description: 'Timeline reset.' })

	async function updateSection(begins: Date, side: string) {
		const timeline = await prisma.timeline.findMany({ where: { side }, orderBy: { order: 'asc' } })

		let start,
			stop = begins
		for (let { id, hours } of timeline) {
			if (hours === 0) continue
			start = stop
			stop = add(start, { hours })
			await prisma.timeline.update({ data: { start, stop }, where: { id } })
		}
	}
}

export default function PrintableTimelineRoute() {
	const submit = useSubmit()
	const userIsAdmin = useOptionalAdminUser()
	const data = useLoaderData<typeof loader>()

	const [showAll, setShowAll] = useState(false)
	const toggleShowAll = () => setShowAll(!showAll)

	const { status, schedule, users } = data
	const { id: scheduleId, date: scheduleDate } = schedule

	const [leftdatetime, setLeftDatetime] = useState(data.sideMinimum?.left ?? '')
	const [rightdatetime, setRightDatetime] = useState(data.sideMinimum?.right ?? '')

	const getTimestamp = (ev: any): string => {
		if (!ev.target['validity'].valid) return ''
		return ev.target['value'] + ':00Z'
	}
	const handleChangeLeft = (ev: any) => {
		const left = getTimestamp(ev)
		setLeftDatetime(left)
		submit({ intent: 'update-left', begin: left }, { method: 'post' })
	}
	const handleChangeRight = (ev: any) => {
		const right = getTimestamp(ev)
		setRightDatetime(right)
		submit({ intent: 'update-right', begin: right }, { method: 'post' })
	}

	if (status !== 'idle' || !scheduleId || !users || !Object.keys(users).length) return null

	return (
		<div className="text-align-webkit-center flex w-full flex-col items-center justify-center gap-1 bg-background">
			{userIsAdmin ? (
				<div className="flex w-[70%] flex-row justify-between gap-2 p-0.5">
					<Button variant="outline" onClick={toggleShowAll} className="w-[150px] pb-2">
						Display {showAll ? 'Scheduled' : 'All'}
					</Button>
					<div className="flex">
						<input
							className="float-right mr-2 rounded-sm bg-secondary p-2 text-body-lg"
							aria-label="Date and time"
							type="datetime-local"
							step="1800"
							value={(leftdatetime || '').toString().substring(0, 16)}
							onChange={handleChangeLeft}
						/>
						<input
							className="ml-2 rounded-sm bg-secondary p-2 text-body-lg"
							aria-label="Date and time"
							type="datetime-local"
							step="1800"
							value={(rightdatetime || '').toString().substring(0, 16)}
							onChange={handleChangeRight}
						/>
					</div>
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
			) : null}
			<div className="text-align-webkit-center flex w-full flex-col items-center justify-center gap-1 bg-background">
				<main className="m-auto w-[90%]" style={{ height: 'fill-available' }}>
					{Object.keys(users).map(page => (
						<div key={`${page}`} className="m-auto block overflow-x-auto overflow-y-auto">
							<Separator className="mb-4 mt-4" />
							<table className="w-[80%]">
								<thead>
									<tr>
										<td className="text-center text-body-lg">Ditch {page === '0' ? 9 : Number(page)}</td>
										<td className="text-center text-body-lg">Ditch {page === '0' ? 9 : Number(page) + 4}</td>
									</tr>
								</thead>
								{Object.keys(users[page]).map(position => {
									const { left, right } = users[page][position]
									return (
										<tr className="w-[100%]" key={`${position}`}>
											<td className="w-[50%] p-0.5">
												{left && (left.hours || showAll) ? (
													<UserCard scheduleDate={scheduleDate} user={left} />
												) : (
													<div></div>
												)}
											</td>
											<td className="w-[50%] p-0.5">
												{right && (right.hours || showAll) ? (
													<UserCard scheduleDate={scheduleDate} user={right} />
												) : (
													<div></div>
												)}
											</td>
										</tr>
									)
								})}
							</table>
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
				<span className="w-[30%] overflow-hidden text-ellipsis text-nowrap text-left text-body-sm text-muted-foreground">
					{user.position}: {user.display}
				</span>
				<span className="w-[10%] overflow-hidden text-ellipsis text-nowrap text-right text-body-sm text-muted-foreground">
					{formatHours(Number(user.hours))}
				</span>
				{user.schedule.map((row, r) => (
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

import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { formatDistance, formatDistanceStrict, subDays, isBefore, isAfter, addDays, format } from 'date-fns'
import { useEffect, useState } from 'react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Badge } from '#app/components/ui/badge'
import { Button } from '#app/components/ui/button'
import { Icon } from '#app/components/ui/icon.tsx'
import { getUserId } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server.ts'
import { formatDates, formatHrs, formatHours, getDateTimeFormat } from '#app/utils/misc'
import { backgroundColor, borderColor, SearchResultsSchema } from '#app/utils/user-schedule.ts'

export type UserScheduleType = {
	userId: string
	portId: string
	display: string | null
	ditch: number
	position: number
	entry: string
	section: string
	hours: number | bigint | null
	start: Date | string | null
	stop: Date | string | null
	schedule?: string[]
	first?: boolean | null
	crossover?: boolean | null
	last?: boolean | null
	isCurrentUser?: boolean | null
	isCurrentSchedule?: boolean | null
	distanceToNow?: string | null
}

type DistanceType = {
	isCurrentSchedule: boolean
	distanceToNow: string
	start: number
	stop: number
}

export type DistancesType = {
	// userId-portId: string
	[key: string]: DistanceType
}

type SortedSchedulesType = { [key: string]: { [key: number]: UserScheduleType[] } }

export async function loader({ request }: LoaderFunctionArgs) {
	const currentUserId = await getUserId(request)
	const port = await prisma.port.findFirst({ select: { entry: true }, where: { userId: currentUserId } })
	const entry = port?.entry ?? '10-01'

	const time = getDateTimeFormat(request).format(new Date())
	const yesterday = subDays(time, 1)
	const tomorrow = addDays(time, 1)

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
     WHERE User.active
       AND UserSchedule.start >= ${yesterday}
       AND UserSchedule.start <= ${tomorrow}
     ORDER BY UserSchedule.start ASC
  `

	const result = SearchResultsSchema.safeParse(rawUsers)
	if (!result.success) {
		return json({ status: 'error', schedules: {}, distances: {}, entry, first: yesterday, last: tomorrow } as const, {
			status: 400,
		})
	}
	invariantResponse(result.data.length, 'No UserSchedules found', { status: 404 })
	const first = format(result.data[0].start ?? yesterday, 'eee, MMM dd, h:mmaaa')
	const last = format(result.data[result.data.length - 1].stop ?? tomorrow, 'eee, MMM dd, h:mmaaa')

	const ten01 = result.data.some(row => row.entry === '10-01')
	const ten03 = result.data.some(row => row.entry === '10-03')

	if (!ten01) {
		const ten01Users = await prisma.$queryRaw`
      SELECT User.id AS userId, User.display, 
             Port.id AS portId, Port.ditch, Port.position, Port.entry, Port.section, 
             UserSchedule.hours, UserSchedule.start, UserSchedule.stop,
             UserSchedule.first, UserSchedule.crossover, UserSchedule.last
        FROM User
       INNER JOIN Port ON User.id = Port.userId
        LEFT JOIN UserSchedule
          ON User.id = UserSchedule.userId
         AND Port.id = UserSchedule.portId
       WHERE Port.entry = '10-01'
		   ORDER BY UserSchedule.start DESC
		   LIMIT 1`
		const ten01result = SearchResultsSchema.safeParse(ten01Users)
		if (ten01result.success && ten01result.data.length) result.data.push(ten01result.data[0])
	}
	if (!ten03) {
		const ten03Users = await prisma.$queryRaw`
      SELECT User.id AS userId, User.display, 
             Port.id AS portId, Port.ditch, Port.position, Port.entry, Port.section, 
             UserSchedule.hours, UserSchedule.start, UserSchedule.stop,
             UserSchedule.first, UserSchedule.crossover, UserSchedule.last
        FROM User
       INNER JOIN Port ON User.id = Port.userId
        LEFT JOIN UserSchedule
          ON User.id = UserSchedule.userId
         AND Port.id = UserSchedule.portId
       WHERE Port.entry = '10-03'
		   ORDER BY UserSchedule.start DESC
		   LIMIT 1`
		const ten03result = SearchResultsSchema.safeParse(ten03Users)
		if (ten03result.success && ten03result.data.length) result.data.push(ten03result.data[0])
	}

	const schedules: SortedSchedulesType = {}
	const distances: DistancesType = {}
	for (let userSchedule of result.data) {
		// user groupings
		const { userId, portId, entry, ditch, start, stop } = userSchedule
		const userType = {
			...userSchedule,
			schedule: formatDates({ start, stop }),
			isCurrentUser: userId === currentUserId,
		}
		if (!schedules[entry]) schedules[entry] = { [ditch]: [userType] }
		else if (!schedules[entry][ditch]) schedules[entry][ditch] = [userType]
		else schedules[entry][ditch].push(userType)

		const { isCurrentSchedule, distanceToNow } = calcDistanceToNow(Number(start), Number(stop), time)
		distances[`${userId}-${portId}`] = { start: Number(start), stop: Number(stop), isCurrentSchedule, distanceToNow }
	}
	return json({ status: 'idle', schedules, distances, entry, first, last } as const)
}

const calcDistanceToNow = (
	start: number,
	stop: number,
	time: string | Date,
): { isCurrentSchedule: boolean; distanceToNow: string } => {
	if (!start || !stop) return { isCurrentSchedule: false, distanceToNow: '' }
	// return ''
	const finished = isBefore(stop, time)
	if (finished) {
		const distance = formatDistance(stop, time, { addSuffix: true })
		return { isCurrentSchedule: false, distanceToNow: `Finished ${distance}` }
	} else {
		const isCurrentSchedule = isBefore(start, time) && isAfter(stop, time)
		if (isCurrentSchedule) {
			const distance = formatDistanceStrict(time, stop)
			return { isCurrentSchedule, distanceToNow: `Irrigating another ${distance}` }
		} /*Starts in */ else {
			const distance = formatDistance(start, time, { addSuffix: true })
			return { isCurrentSchedule, distanceToNow: `Starts ${distance}` }
		}
	}
}

export default function TimelineRoute() {
	const { status, schedules, distances, entry, first, last } = useLoaderData<typeof loader>()

	const [visible, setVisible] = useState(entry)
	const [localDistances, setLocalDistances] = useState(distances)
	const [lastUpdated, setLastUpdated] = useState(format(new Date(), 'MM/dd/yyyy h:mm:ssaaa'))
	const handleToggleVisible = (value: string) => setVisible(value)

	const clock = () => {
		let date = new Date()
		const d = { ...localDistances }
		for (let [key, { start, stop }] of Object.entries(d)) {
			const { isCurrentSchedule, distanceToNow } = calcDistanceToNow(start, stop, date)
			d[key] = { start, stop, isCurrentSchedule, distanceToNow }
		}
		setLocalDistances(d)
		setLastUpdated(date.toLocaleTimeString())
	}
	useEffect(() => {
		setInterval(clock, 5 /*min */ * 60 * 1000)
	}, [])

	if (!schedules || status !== 'idle') return null

	return (
		<div className="h-vh mx-auto flex min-w-[80%] flex-col gap-1 p-1">
			<div
				id="title-row"
				className="border-1 my-1 flex w-full items-center justify-center rounded-lg border-secondary-foreground bg-sky-800 p-2 text-white"
			>
				<div className="flex-1">** Updates every 5 minutes.</div>
				<Icon name="droplets" className="mx-1 h-8 w-8 p-1" aria-hidden="true" />
				<div className="text-xl">Where is the water currently?</div>
				<Icon name="droplet" className="mx-1 h-8 w-8 p-1" aria-hidden="true" />
				<div className="w-full flex-1 text-right">Updated: {lastUpdated}</div>
			</div>
			<div id="header-row" className="flex w-full flex-row items-end justify-between">
				<div id="from-label" className={`border-1 rounded-lg p-2 ${borderColor({ first: true })}`}>
					<strong>From:&nbsp;</strong>
					{first}
				</div>
				<div id="entry-toggle" className="flex flex-col justify-center md:flex-row">
					<Button
						variant="outline-link"
						className={`m-1 w-40 text-nowrap ${visible === '10-01' && 'bg-secondary underline underline-offset-4'}`}
						onClick={() => handleToggleVisible('10-01')}
					>
						[10-01] (Ditches 1-4)
					</Button>
					<Button
						variant="outline-link"
						className={`m-1 w-40 text-nowrap ${visible === '10-03' && 'bg-secondary underline underline-offset-4'}`}
						onClick={() => handleToggleVisible('10-03')}
					>
						[10-03] (Ditches 5-8)
					</Button>
				</div>
				<div id="to-label" className={`border-1 rounded-lg p-2 ${borderColor({ last: true })}`}>
					<strong>To:&nbsp;</strong>
					{last}
				</div>
			</div>
			{Object.keys(schedules[visible]).map(ditch => (
				<>
					<div className="mt-2 w-full rounded-md bg-primary p-2 text-center text-body-lg text-secondary">
						{`[${visible}] Ditch ${ditch}`}
					</div>
					{schedules[visible][Number(ditch)].map(userSchedule => (
						<UserCard
							key={`${userSchedule.start}`}
							userSchedule={userSchedule}
							// @ts-ignore
							distance={localDistances[`${userSchedule.userId}-${userSchedule.portId}`]}
						/>
					))}
				</>
			))}
		</div>
	)
}

function UserCard({
	userSchedule: { display, hours, position, schedule, first, crossover, last, isCurrentUser },
	distance: { isCurrentSchedule, distanceToNow },
}: {
	userSchedule: UserScheduleType
	distance: DistanceType
}) {
	return (
		<div
			id="user-row"
			className={`border-1 flex w-full flex-row justify-between rounded-lg border-secondary-foreground p-2 pl-4 md:flex-row md:items-center
					${isCurrentSchedule ? 'bg-sky-800 text-white' : isCurrentUser ? 'bg-secondary' : 'bg-muted-40'} 
					${borderColor({ first, crossover, last })}`}
		>
			<div
				id="user-details"
				className="flex w-full flex-col justify-around rounded-lg border-secondary-foreground p-2 md:flex-row md:items-center"
			>
				<div
					id="position-username"
					className="flex flex-row overflow-hidden text-ellipsis text-nowrap text-left text-body-sm"
				>
					<div id="position" className="ml-0 flex w-6 justify-end max-md:hidden">
						{position}:&nbsp;
					</div>
					<strong id="username" className="min-w-40">
						{display}
					</strong>
				</div>
				<div id="start-stop-schedules" className="flex min-w-80 flex-col justify-between lg:flex-row">
					<div id="distance-to-now" className="min-w-52 text-body-sm">
						{distanceToNow}
					</div>
					<div id="hours" className="min-w-20 pr-2 text-body-sm">
						<div className="flex lg:hidden">Signed up for {formatHours(Number(hours))}</div>
						<strong className="float-right flex max-lg:hidden">{formatHrs(Number(hours))}</strong>
					</div>
				</div>
				{schedule ? (
					<div id="start-stop-schedules" className="flex flex-col justify-between lg:flex-row">
						{schedule.map((row, r) => (
							<div key={`row-${r}`} className="min-w-44 overflow-hidden text-ellipsis text-body-sm">
								{row}
							</div>
						))}
					</div>
				) : null}
			</div>
			<div id="charges-pills" className="flex h-full min-w-20 flex-col items-end gap-1">
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
	)
}

export const meta: MetaFunction<null, { 'routes/irrigation': typeof loader }> = () => {
	return [
		{ title: 'Irrigation | Water Location' },
		{
			name: 'description',
			content: `Clearwater Farms 1 Irrigation Timeline`,
		},
	]
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}

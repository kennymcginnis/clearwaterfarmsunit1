import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { formatDistance, formatDistanceStrict, subDays, isBefore, isAfter, addDays, format } from 'date-fns'
import { useState } from 'react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Badge } from '#app/components/ui/badge'
import { Button } from '#app/components/ui/button'
import { Icon } from '#app/components/ui/icon.tsx'
import { getUserId } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server.ts'
import { formatDates, formatHrs } from '#app/utils/misc'
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

type SortedSchedulesType = { [key: string]: { [key: number]: UserScheduleType[] } }

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await getUserId(request)
	const port = await prisma.port.findFirst({ select: { entry: true }, where: { userId } })
	const entry = port?.entry ?? '10-01'

	const toUTC = (d: Date): Date =>
		new Date(
			d.getUTCFullYear(),
			d.getUTCMonth(),
			d.getUTCDate(),
			d.getUTCHours(),
			d.getUTCMinutes(),
			d.getUTCSeconds(),
			d.getUTCMilliseconds(),
		)
	const nowInUTC = toUTC(new Date())

	const serverTime = new Date()
	const yesterday = subDays(serverTime, 1)
	const tomorrow = addDays(serverTime, 1)

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
		return json({ status: 'error', schedules: {}, entry, first: yesterday, last: tomorrow } as const, { status: 400 })
	}
	invariantResponse(result.data.length, 'No UserSchedules found', { status: 404 })
	const first = format(/* result.data[0].start ?? */ yesterday, 'eee, MMM dd, h:mmaaa')
	const last = format(/* result.data[result.data.length - 1].stop ?? */ tomorrow, 'eee, MMM dd, h:mmaaa')

	const calcDistanceToNow = (
		start: Date | null,
		stop: Date | null,
	): { isCurrentSchedule: boolean; distanceToNow: string } => {
		if (!start || !stop) return { isCurrentSchedule: false, distanceToNow: '' }
		// return ''
		const finished = isBefore(stop, nowInUTC)
		if (finished) {
			const distance = formatDistance(stop, nowInUTC, { addSuffix: true })
			return { isCurrentSchedule: false, distanceToNow: `Finished ${distance}` }
		} else {
			const isCurrentSchedule = isBefore(start, nowInUTC) && isAfter(stop, nowInUTC)
			if (isCurrentSchedule) {
				const distance = formatDistanceStrict(nowInUTC, stop)
				return { isCurrentSchedule, distanceToNow: `Irrigating another ${distance}` }
			} /*Starts in */ else {
				const distance = formatDistance(start, nowInUTC, { addSuffix: true })
				return { isCurrentSchedule, distanceToNow: `Starts ${distance}` }
			}
		}
	}

	const schedules: SortedSchedulesType = {}
	for (let userSchedule of result.data) {
		// user groupings
		const { start, stop, ditch, entry } = userSchedule
		const { isCurrentSchedule, distanceToNow } = calcDistanceToNow(start, stop)
		const userType = {
			...userSchedule,
			schedule: formatDates({ start, stop }),
			isCurrentUser: userSchedule.userId === userId,
			isCurrentSchedule,
			distanceToNow,
		}
		if (!schedules[entry]) schedules[entry] = { [ditch]: [userType] }
		else if (!schedules[entry][ditch]) schedules[entry][ditch] = [userType]
		else schedules[entry][ditch].push(userType)
	}
	return json({ status: 'idle', schedules, entry, first, last } as const)
}

export default function TimelineRoute() {
	const { status, schedules, entry, first, last } = useLoaderData<typeof loader>()

	const [visible, setVisible] = useState(entry)
	const handleToggleVisible = (value: string) => setVisible(value)

	if (!schedules || status !== 'idle') return null

	return (
		<div className="flex flex-col items-center">
			<div className="flex flex-row justify-center">
				<div className="flex flex-col gap-1">
					<div className="border-1 my-1 flex justify-center rounded-lg border-secondary-foreground bg-sky-800 p-2 text-xl text-white">
						<Icon name="droplets" className="mx-1 h-8 w-8 p-1" aria-hidden="true" />
						Where is the water currently? **Note: Work in Progress**
						<Icon name="droplet" className="mx-1 h-8 w-8 p-1" aria-hidden="true" />
					</div>
					<div className="flex w-full flex-row items-end justify-around">
						<div className={`border-1 flex rounded-lg p-2 ${borderColor({ first: true })}`}>
							<strong>From:&nbsp;</strong>
							{first}
						</div>
						<div className="flex flex-row justify-center">
							<Button
								variant="outline-link"
								className={`mx-0.5 my-1 text-nowrap ${visible === '10-01' && 'bg-secondary underline underline-offset-4'}`}
								onClick={() => handleToggleVisible('10-01')}
							>
								[10-01] (Ditches 1-4)
							</Button>
							<Button
								variant="outline-link"
								className={`mx-0.5 my-1 text-nowrap ${visible === '10-03' && 'bg-secondary underline underline-offset-4'}`}
								onClick={() => handleToggleVisible('10-03')}
							>
								[10-03] (Ditches 5-8)
							</Button>
						</div>
						<div className={`border-1 flex rounded-lg p-2 ${borderColor({ last: true })}`}>
							<strong>To:&nbsp;</strong>
							{last}
						</div>
					</div>
					{Object.keys(schedules[visible]).map(ditch => (
						<>
							<div className="mt-2 rounded-md bg-primary p-2 text-center text-body-lg text-secondary">
								{`[${visible}] Ditch ${ditch}`}
							</div>
							{schedules[visible][Number(ditch)].map(userSchedule => (
								<UserCard key={`${userSchedule.start}`} userSchedule={userSchedule} />
							))}
						</>
					))}
				</div>
			</div>
		</div>
	)
}

function UserCard({
	userSchedule: {
		display,
		hours,
		position,
		schedule,
		first,
		crossover,
		last,
		isCurrentUser,
		isCurrentSchedule,
		distanceToNow,
	},
}: {
	userSchedule: UserScheduleType
}) {
	return (
		<div
			className={`border-1 flex rounded-lg border-secondary-foreground ${isCurrentSchedule ? 'bg-sky-800   text-white' : isCurrentUser ? 'bg-secondary' : 'bg-muted-40'} p-2 ${borderColor({ first, crossover, last })}`}
		>
			{isCurrentSchedule && <div id="now" />}
			<div className={`grid w-full grid-flow-row-dense grid-cols-12 justify-between gap-1`}>
				<span className="col-span-2 overflow-hidden text-ellipsis text-nowrap text-left text-body-sm">
					{position}: {display}
				</span>
				<div className="col-span-2">{distanceToNow}</div>
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

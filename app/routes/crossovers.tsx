import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { formatDistance, formatDistanceStrict, subDays, isBefore, isAfter } from 'date-fns'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Badge } from '#app/components/ui/badge'
import { Icon } from '#app/components/ui/icon.tsx'
import { getUserId } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server.ts'
import { formatDate, getDateTimeFormat } from '#app/utils/misc'
import { backgroundColor, crossover, SearchResultsSchema } from '#app/utils/user-schedule.ts'

export type UserScheduleType = {
	userId: string
	portId: string
	display: string | null
	quickbooks?: string | null
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
	duties: string
}

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await getUserId(request)
	const time = getDateTimeFormat(request).format(new Date())
	const yesterday = subDays(time, 1)

	const rawUsers = await prisma.$queryRaw`
    SELECT User.id AS userId, User.display, User.quickbooks, 
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
       AND (UserSchedule.first OR UserSchedule.crossover OR UserSchedule.last)
     ORDER BY UserSchedule.start ASC
  `

	const result = SearchResultsSchema.safeParse(rawUsers)
	if (!result.success) return json({ status: 'error', schedules: {} } as const, { status: 400 })
	invariantResponse(result.data.length, 'No UserSchedules found', { status: 404 })

	const calcDistanceToNow = (
		start: Date | null,
		stop: Date | null,
	): { isCurrentSchedule: boolean; distanceToNow: string } => {
		if (!start || !stop) return { isCurrentSchedule: false, distanceToNow: '' }
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

	const schedules: UserScheduleType[] = result.data.map(userSchedule => {
		// user groupings
		const { start, stop, ditch, entry, section } = userSchedule
		const { isCurrentSchedule, distanceToNow } = calcDistanceToNow(start, stop)
		return {
			...userSchedule,
			duties: crossover[ditch][entry][section].description,
			start: formatDate(start),
			isCurrentUser: userSchedule.userId === userId,
			isCurrentSchedule,
			distanceToNow,
		}
	})
	return json({ status: 'idle', schedules } as const)
}

export default function TimelineRoute() {
	const { status, schedules } = useLoaderData<typeof loader>()

	if (!schedules || status !== 'idle') return null

	return (
		<div className="h-vh mx-auto flex min-w-[80%] flex-col gap-1 p-1">
			<div
				id="title-row"
				className="border-1 my-1 flex w-full justify-center rounded-lg border-secondary-foreground bg-sky-800 p-2 text-xl text-white"
			>
				<Icon name="droplets" className="mx-1 h-8 w-8 p-1" aria-hidden="true" />
				Crossovers:
				<Icon name="droplet" className="mx-1 h-8 w-8 p-1" aria-hidden="true" />
			</div>
			{schedules.map(userSchedule => (
				<UserCard key={`${userSchedule.start}`} userSchedule={userSchedule} />
			))}
		</div>
	)
}

function UserCard({
	userSchedule: { quickbooks, duties, start, first, crossover, last, isCurrentUser, isCurrentSchedule, distanceToNow },
}: {
	userSchedule: UserScheduleType
}) {
	return (
		<div
			id="user-row"
			className={`border-1 flex w-full flex-row items-start justify-between rounded-lg border-secondary-foreground p-2 md:flex-row md:items-center
					${isCurrentSchedule ? 'bg-sky-800 text-white' : isCurrentUser ? 'bg-secondary' : 'bg-muted-40'}`}
		>
			<div
				id="user-details"
				className="flex w-full flex-col justify-between rounded-lg border-secondary-foreground p-2 md:flex-row md:items-center"
			>
				<div id="quickbooks-duties" className="flex min-w-80 flex-col items-start justify-between">
					<strong id="quickbooks" className="overflow-hidden text-ellipsis text-nowrap">
						{quickbooks}
					</strong>
					<div id="duties" className="w-full overflow-hidden text-ellipsis text-wrap">
						{duties}
					</div>
				</div>
				<div id="distance-start" className="flex min-w-80 flex-col items-start justify-between lg:flex-row">
					<div id="distance-to-now" className="min-w-60 overflow-hidden text-ellipsis pr-2 text-body-sm">
						{distanceToNow}
					</div>
					<div id="start" className="min-w-44 overflow-hidden text-ellipsis text-body-sm">
						{String(start)}
					</div>
				</div>
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

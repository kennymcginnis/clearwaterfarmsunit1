import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node'
import { Form, useLoaderData } from '@remix-run/react'
import { formatDistance, formatDistanceStrict, isBefore, isAfter } from 'date-fns'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Badge } from '#app/components/ui/badge'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { getUserId } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server.ts'
import { formatDate, getDateTimeFormat } from '#app/utils/misc'
import { backgroundColor, crossovers, SearchResultsSchema } from '#app/utils/user-schedule.ts'

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
	duties: { [key: string]: string }
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	const userId = await getUserId(request)

	const schedule = await prisma.schedule.findFirst({ select: { id: true, state: true }, where: { date: params.date } })
	invariantResponse(schedule?.id, 'Schedule Not found', { status: 404 })
	const scheduleId = schedule?.id

	const time = getDateTimeFormat(request).format(new Date())

	const rawUsers = await prisma.$queryRaw`
    SELECT User.id AS userId, User.display, User.quickbooks, 
           Port.id AS portId, Port.ditch, Port.position, Port.entry, Port.section, Port.address, 
           UserSchedule.hours, UserSchedule.start, UserSchedule.stop,
           UserSchedule.first, UserSchedule.crossover, UserSchedule.last
      FROM User
     INNER JOIN Port ON User.id = Port.userId
      LEFT JOIN UserSchedule
        ON User.id = UserSchedule.userId
       AND Port.id = UserSchedule.portId
     WHERE User.active
		   AND UserSchedule.scheduleId = ${schedule.id}
       AND (UserSchedule.first OR UserSchedule.crossover)
     ORDER BY UserSchedule.start ASC
  `

	const result = SearchResultsSchema.safeParse(rawUsers)
	if (!result.success) return json({ status: 'error', schedules: {}, scheduleId } as const, { status: 400 })

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
		const { start, stop, ditch, entry } = userSchedule
		const { isCurrentSchedule, distanceToNow } = calcDistanceToNow(start, stop)
		const duties = crossovers[ditch][entry]
		return {
			...userSchedule,
			duties,
			start: formatDate(start),
			isCurrentUser: userSchedule.userId === userId,
			isCurrentSchedule,
			distanceToNow,
		}
	})
	return json({ status: 'idle', scheduleId, schedules } as const)
}

export default function TimelineRoute() {
	const { status, schedules, scheduleId } = useLoaderData<typeof loader>()

	if (!schedules || status !== 'idle') return null

	return (
		<div className="h-vh mx-auto flex min-w-[80%] flex-col gap-1 p-1">
			<div
				id="title-row"
				className="border-1 my-1 flex w-full justify-center rounded-lg border-secondary-foreground bg-sky-800 p-2 text-2xl text-white"
			>
				<Icon name="droplets" className="mx-1 h-8 w-8 p-1" aria-hidden="true" />
				Crossovers:
				<Icon name="droplet" className="mx-1 h-8 w-8 p-1" aria-hidden="true" />
			</div>
			{schedules.map((userSchedule, index) => (
				<UserCard key={`${userSchedule.start}`} scheduleId={scheduleId} userSchedule={userSchedule} />
			))}
		</div>
	)
}

function UserCard({
	scheduleId,
	userSchedule: {
		userId,
		portId,
		quickbooks,
		duties,
		start,
		first,
		crossover,
		last,
		isCurrentUser,
		isCurrentSchedule,
		distanceToNow,
	},
}: {
	scheduleId: string
	userSchedule: UserScheduleType
}) {
	return (
		<div
			id="user-row"
			className={`border-1 flex w-full flex-row items-start justify-between rounded-lg border-secondary-foreground p-2 md:flex-row md:items-center
					${isCurrentSchedule ? 'bg-sky-800 text-white' : isCurrentUser ? 'bg-secondary' : 'bg-muted-40'}`}
		>
			<div id="user-details" className="flex w-full flex-col justify-between p-2 md:flex-row md:items-center">
				<div id="quickbooks-duties" className="flex min-w-[60%] flex-col items-start justify-between">
					<strong id="quickbooks" className="mb-1 overflow-hidden text-ellipsis text-nowrap underline">
						{quickbooks}
					</strong>
					<div id="charges-pills" className="flex h-full min-w-20 flex-col items-start gap-1">
						{first && (
							<div className="flex flex-row">
								<Badge
									className={`ml-[40px] mr-1 capitalize ${backgroundColor('first')} ${isCurrentSchedule && 'text-white'}`}
									variant="outline"
								>
									{'First'}
								</Badge>
								<div>{duties.first}</div>
							</div>
						)}
						{crossover && (
							<div className="flex flex-row">
								<Badge
									className={`ml-[10px] mr-1 capitalize ${backgroundColor('crossover')} ${isCurrentSchedule && 'text-white'}`}
									variant="outline"
								>
									{'Crossover'}
								</Badge>
								<div>{duties.crossover}</div>
							</div>
						)}
						{last && (
							<div className="flex flex-row">
								<Badge
									className={`ml-[42px] mr-1 capitalize ${backgroundColor('last')} ${isCurrentSchedule && 'text-white'}`}
									variant="outline"
								>
									{'Last'}
								</Badge>
								<div>{duties.last}</div>
							</div>
						)}
					</div>
				</div>
				<div
					id="distance-start"
					className="mt-2 flex min-w-40 flex-row items-start justify-between border-t-[1px] border-secondary-foreground sm:flex-col md:mt-0 md:border-none"
				>
					<div id="distance-to-now" className="min-w-60 overflow-hidden text-ellipsis pr-2 text-body-sm">
						{distanceToNow}
					</div>
					<div id="start" className="min-w-44 overflow-hidden text-ellipsis text-body-sm">
						{String(start)}
					</div>
				</div>
				{isCurrentUser ? (
					<div className="pr-2">
						<Form method="post" encType="multipart/form-data">
							<input type="hidden" name="userId" value={userId} />
							<input type="hidden" name="portId" value={portId} />
							<input type="hidden" name="scheduleId" value={scheduleId} />
							<Button type="submit" name="intent" value="reset" variant="secondary" className="mr-1">
								Acknowledge
							</Button>
							<Button type="submit" name="intent" value="reset" variant="destructive" className="">
								Request Help
							</Button>
						</Form>
					</div>
				) : (
					<div>
						<Form method="post" encType="multipart/form-data">
							<input type="hidden" name="userId" value={userId} />
							<input type="hidden" name="portId" value={portId} />
							<input type="hidden" name="scheduleId" value={scheduleId} />
							<Button type="submit" name="intent" value="reset" variant="outline-link" className="">
								Volunteer to Help
							</Button>
						</Form>
					</div>
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

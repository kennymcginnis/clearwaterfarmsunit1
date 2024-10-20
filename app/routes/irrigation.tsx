// import { invariantResponse } from '@epic-web/invariant'
// import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node'
// import { useLoaderData } from '@remix-run/react'
// import { addDays, subDays } from 'date-fns'
// import { useState } from 'react'
// import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
// import { Button } from '#app/components/ui/button'
// import { prisma } from '#app/utils/db.server.ts'
// import { formatDates, formatHrs } from '#app/utils/misc'
// import { useOptionalUser } from '#app/utils/user'
// import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '#app/components/ui/carousel'

// type UserType = {
// 	id: string
// 	display: string
// }
// type PortType = {
// 	ditch: number
// 	position: number
// 	entry: string
// 	section: string
// }
// type UserScheduleType = {
// 	hours: number
// 	start: Date | string | null
// 	stop: Date | string | null
// 	user: UserType
// 	port: PortType
// 	schedule: string[]
// }
// type SortedSchedulesType = { [key: string]: UserScheduleType[] }

// export async function loader() {
// 	const yesterday = subDays(new Date(), 12)
// 	const tomorrow = addDays(new Date(), 2)
// 	const userSchedules = await prisma.userSchedule.findMany({
// 		select: {
// 			hours: true,
// 			start: true,
// 			stop: true,
// 			user: { select: { id: true, display: true } },
// 			port: { select: { ditch: true, position: true, entry: true, section: true } },
// 		},
// 		where: {
// 			hours: { gt: 0 },
// 			start: { gte: yesterday },
// 			stop: { lt: tomorrow },
// 		},
// 		orderBy: { start: 'asc' },
// 	})
// 	invariantResponse(userSchedules.length, 'Schedule Not found', { status: 404 })
// 	const schedules: SortedSchedulesType = userSchedules.reduce(
// 		(agg, cur) =>
// 			(
// 				// @ts-ignore
// 				agg[cur.port?.entry].push({ ...cur, schedule: formatDates({ start: cur.start, stop: cur.stop }) }), agg
// 			),
// 		{
// 			'10-01': [],
// 			'10-03': [],
// 		},
// 	)

// 	return json({ status: 'idle', schedules } as const)
// }

// export default function TimelineRoute() {
// 	const user = useOptionalUser()
// 	const defaultUserEntry = user?.ports[0].entry

// 	const { status, schedules } = useLoaderData<typeof loader>()
// 	if (status !== 'idle') return null

// 	const [visible, setVisible] = useState(defaultUserEntry ?? '10-01')
// 	const handleToggleVisible = (value: string) => setVisible(value)

// 	return (
// 		<div className="text-align-webkit-center flex w-full flex-col items-center justify-center gap-1 bg-background">
// 			<div className="text-align-webkit-center flex w-full flex-col items-center justify-center gap-1 bg-background">
// 				<main className="m-auto w-[90%]" style={{ height: 'fill-available' }}>
// 					<div className="m-auto block md:hidden">
// 						<div className="flex w-full flex-row justify-center">
// 							<Button
// 								variant="outline-link"
// 								className={`mx-0.5 my-1 ${visible === '10-01' && 'bg-secondary underline underline-offset-4'}`}
// 								onClick={() => handleToggleVisible('10-01')}
// 							>
// 								[10-01] (Ditches 1-4)
// 							</Button>
// 							<Button
// 								variant="outline-link"
// 								className={`mx-0.5 my-1 ${visible === '10-03' && 'bg-secondary underline underline-offset-4'}`}
// 								onClick={() => handleToggleVisible('10-03')}
// 							>
// 								[10-03] (Ditches 5-8)
// 							</Button>
// 						</div>
// 						<Carousel opts={{ align: 'start' }} orientation="vertical" className="w-full max-w-xs">
// 							<CarouselContent className="-mt-1 h-[200px]">
// 								{schedules[visible].map(userSchedule => (
// 									<UserCard user={userSchedule} />
// 								))}
// 							</CarouselContent>
// 							<CarouselPrevious />
// 							<CarouselNext />
// 						</Carousel>
// 					</div>
// 				</main>
// 			</div>
// 		</div>
// 	)
// }

// function UserCard({ user: userSchedule }: { user: UserScheduleType }) {
// 	const {
// 		hours,
// 		port: { position },
// 		user: { display },
// 		schedule,
// 	} = userSchedule

// 	const backgroundColor = ({
// 		hours,
// 		first,
// 		middle,
// 		last,
// 	}: {
// 		hours: number | bigint | null
// 		first?: boolean
// 		middle?: boolean
// 		last?: boolean
// 	}) => {
// 		if (!hours) return 'bg-muted-40'
// 		if (first) return 'bg-green-900/70 border-1 border-secondary-foreground font-semibold'
// 		if (last) return 'bg-red-900/70 border-1 border-secondary-foreground font-semibold'
// 		if (middle) return 'bg-blue-900/70 border-1 border-secondary-foreground font-semibold'
// 		return 'bg-muted border-1 border-secondary-foreground/40'
// 	}

// 	return (
// 		<CarouselItem className={`flex rounded-lg p-2 ${backgroundColor(userSchedule)}`}>
// 			<div className={`flex w-full flex-row justify-between gap-1`}>
// 				<span className="w-[30%] overflow-hidden text-ellipsis text-nowrap text-left text-body-sm">
// 					{position}: {display}
// 				</span>
// 				<span className="w-[10%] text-nowrap text-right text-body-sm">{formatHrs(Number(hours))}</span>
// 				{schedule.map((row, r) => (
// 					<span key={`row-${r}`} className="w-[30%] overflow-hidden text-ellipsis text-right text-body-sm">
// 						{row}
// 					</span>
// 				))}
// 			</div>
// 		</CarouselItem>
// 	)
// }

// export const meta: MetaFunction<null, { 'routes/schedule+/$date/timeline': typeof loader }> = ({ params }) => {
// 	return [
// 		{ title: `Irrigation Timeline | ${params.date}` },
// 		{
// 			name: 'description',
// 			content: `Clearwater Farms 1 Irrigation Timeline`,
// 		},
// 	]
// }

// export function ErrorBoundary() {
// 	return <GeneralErrorBoundary />
// }

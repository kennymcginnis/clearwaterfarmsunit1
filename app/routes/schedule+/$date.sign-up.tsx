import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { useState } from 'react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList } from '#app/components/forms.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { Button } from '#app/components/ui/button'
import { prisma } from '#app/utils/db.server.ts'
import { cn, useDelayedIsPending } from '#app/utils/misc.tsx'
import { useOptionalUser } from '#app/utils/user.ts'

type TotalType = { [key: number]: number }
type DitchType = { [key: number]: PositionType }
type PositionType = { [key: number]: UserType }
type UserType = {
	id: string
	username: string
	member: string | null
	ditch: number
	position: number
	hours: number | bigint | null
	cost: number | bigint | null
}

const UserSearchResultSchema = z.object({
	id: z.string(),
	username: z.string(),
	member: z.string().nullable(),
	ditch: z.number(),
	position: z.number(),
	hours: z.bigint().or(z.number()).nullable(),
	cost: z.bigint().or(z.number()).nullable(),
})

const UserSearchResultsSchema = z.array(UserSearchResultSchema)

export async function loader({ params }: LoaderFunctionArgs) {
	if (!params?.date) {
		return redirect('/schedules')
	}

	const rawUsers = await prisma.$queryRaw`
		SELECT User.id, User.username, User.member, Port.ditch, Port.position, UserSchedule.hours, UserSchedule.cost
		FROM User
		INNER JOIN Port ON User.id = Port.userId
    LEFT JOIN (
      SELECT UserSchedule.userId, UserSchedule.ditch, UserSchedule.hours, UserSchedule.hours * Schedule.costPerHour as cost
      FROM Schedule 
      INNER JOIN UserSchedule ON Schedule.id = UserSchedule.scheduleId
      WHERE Schedule.date = ${params.date}
    ) UserSchedule
		ON User.id = UserSchedule.userId
		AND Port.ditch = UserSchedule.ditch
		ORDER BY Port.ditch, Port.position
	`

	const result = UserSearchResultsSchema.safeParse(rawUsers)
	if (!result.success) {
		return json({ status: 'error', error: result.error.message } as const, {
			status: 400,
		})
	}

	// initializing all ditches so they all appear in position after searches
	const ditches: DitchType = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {}, 7: {}, 8: {}, 9: {} }
	for (let user of result.data) {
		ditches[user.ditch][user.position] = { ...user }
	}

	const aggregate = await prisma.userSchedule.groupBy({
		by: ['ditch'],
		_sum: { hours: true },
		where: { schedule: { date: params.date } },
	})

	// initializing all ditches so they all appear in position after searches
	const totals: TotalType = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 }
	for (let ditch of aggregate) {
		totals[ditch.ditch] += ditch?._sum?.hours ?? 0
	}

	const scheduleDate: string = params.date

	return json({ status: 'idle', ditches, totals, scheduleDate } as const)
}

export default function UsersRoute() {
	const { status, ditches, totals, scheduleDate } = useLoaderData<typeof loader>()
	const currentUser = useOptionalUser()

	const [showAll, setShowAll] = useState(false)
	const isPending = useDelayedIsPending({
		formMethod: 'GET',
		formAction: '/schedules',
	})

	if (status === 'error') {
		console.error(error)
	}

	const toggleShowAll = () => setShowAll(!showAll)

	return (
		<>
			<Button variant="outline" onClick={toggleShowAll} className="pb-2">
				Display {showAll ? 'Scheduled' : 'All'}
			</Button>
			{currentUser ? (
				<Button asChild variant="secondary" className="ml-2">
					<Link to={`/schedule/${scheduleDate}/${currentUser.username}`}>Jump to Self</Link>
				</Button>
			) : null}
			<Spacer size="4xs" />

			{status === 'idle' ? (
				ditches ? (
					<>
						<div
							className={cn('grid w-full grid-cols-9 gap-4 delay-200', {
								'opacity-50': isPending,
							})}
						>
							{Object.keys(ditches).map(d => (
								<div key={`ditch-${d}`}>
									<p className="mb-2 w-full text-center text-body-lg">
										Ditch {d} ({totals[+d]})
									</p>
								</div>
							))}
						</div>
						<div className="grid max-h-[700px] w-full grid-cols-9 gap-4 overflow-auto delay-200">
							{Object.entries(ditches).map(([d, ditch]) => (
								<div key={`ditch-${d}`}>
									{Object.entries(ditch)
										.filter(([p, user]) => (user.hours || 0) > 0 || showAll)
										.map(([p, user]) => (
											<div key={`position-${p}`}>
												<Link
													to={`/schedule/${scheduleDate}/${user.username}`}
													className="mb-2 grid grid-cols-2 items-center justify-end rounded-lg bg-muted px-5 py-3"
												>
													<span className="overflow-hidden text-ellipsis text-nowrap text-body-sm text-muted-foreground">
														{user.username}
													</span>
													<span className="overflow-hidden text-ellipsis text-right text-body-sm text-muted-foreground">
														{Number(user.hours)}
													</span>
												</Link>
											</div>
										))}
								</div>
							))}
						</div>
					</>
				) : (
					<p>No schedule found</p>
				)
			) : status === 'error' ? (
				<ErrorList errors={['There was an error parsing the results']} />
			) : null}
		</>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}

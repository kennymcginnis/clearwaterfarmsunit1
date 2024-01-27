import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { format } from 'date-fns'
import { useState } from 'react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList } from '#app/components/forms.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { Button } from '#app/components/ui/button'
import { prisma } from '#app/utils/db.server.ts'
import { cn, useDelayedIsPending } from '#app/utils/misc.tsx'
import { useOptionalUser } from '#app/utils/user.ts'

type DitchType = { [key: number]: PositionType }
type PositionType = { [key: number]: UserType }
type UserType = {
	id: string
	username: string
	member: string | null
	ditch: number
	position: number
	hours: number | null
	start: Date | null
	stop: Date | null
	starting: string | null
	stoping: string | null
}

const UserSearchResultSchema = z.object({
	id: z.string(),
	username: z.string(),
	member: z.string().nullable(),
	ditch: z.number(),
	position: z.number(),
	hours: z.number().nullable(),
	start: z.date().nullable(),
	stop: z.date().nullable(),
})

const UserSearchResultsSchema = z.array(UserSearchResultSchema)

export async function loader({ params }: LoaderFunctionArgs) {
	if (!params?.date) {
		return redirect('/schedules')
	}

	const totals = await prisma.userSchedule.groupBy({
		by: ['ditch'],
		_sum: {
			hours: true,
		},
	})

	const rawUsers = await prisma.$queryRaw`
		SELECT User.id, User.username, User.member, Port.ditch, Port.position, UserSchedule.hours, UserSchedule.start, UserSchedule.stop
		FROM User
		INNER JOIN Port ON User.id = Port.userId
    LEFT JOIN (
      SELECT UserSchedule.userId, UserSchedule.ditch, UserSchedule.hours, UserSchedule.start, UserSchedule.stop
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
	const ditches: DitchType = {
		1: {},
		2: {},
		3: {},
		4: {},
		5: {},
		6: {},
		7: {},
		8: {},
		9: {},
	}

	for (let user of result.data) {
		ditches[user.ditch][user.position] = {
			...user,
			starting: user.start ? format(user.start, 'MMM do h:mmaaa') : '',
			stoping: user.stop ? format(user.stop, 'MMM do h:mmaaa') : '',
		}
	}

	return json({ status: 'idle', ditches, totals, scheduleDate: params.date } as const)
}

export default function UsersRoute() {
	const currentUser = useOptionalUser()
	const data = useLoaderData<typeof loader>()

	const [showAll, setShowAll] = useState(false)
	const isPending = useDelayedIsPending({
		formMethod: 'GET',
		formAction: '/schedules',
	})

	if (data.status === 'error') {
		console.error(data.error)
	}

	const toggleShowAll = () => setShowAll(!showAll)

	const pretty = (hours: number | null) =>
		!hours ? '' : hours === 1 ? '(1-hour)' : hours % 1 === 0 ? `(${hours}-hours)` : `(${hours}-hrs)`

	return (
		<>
			<Button variant="outline" onClick={toggleShowAll} className="pb-2">
				Display {showAll ? 'Scheduled' : 'All'}
			</Button>
			{currentUser ? (
				<Button asChild variant="secondary" className="ml-2">
					<Link to={`/schedule/${data.scheduleDate}/${currentUser.username}`}>Jump to Self</Link>
				</Button>
			) : null}
			<Spacer size="4xs" />

			{data.status === 'idle' ? (
				data.ditches ? (
					<>
						<div
							className={cn('grid w-full grid-cols-9 gap-4 delay-200', {
								'opacity-50': isPending,
							})}
						>
							{Object.keys(data.ditches).map(d => (
								<div key={`ditch-${d}`}>
									<p className="mb-2 w-full text-center text-body-lg">
										Ditch {d} ({data.totals[+d - 1]._sum.hours})
									</p>
								</div>
							))}
						</div>
						<div className="grid max-h-[700px] w-full grid-cols-9 gap-4 overflow-auto delay-200">
							{Object.entries(data.ditches).map(([d, ditch]) => (
								<div key={`ditch-${d}`}>
									{Object.entries(ditch)
										.filter(([p, user]) => user.start || showAll)
										.map(([p, user]) => (
											<div key={`position-${p}`}>
												<Link
													to={`/schedule/${data.scheduleDate}/${user.username}`}
													className="mb-2 grid grid-rows-3 items-center justify-end rounded-lg bg-muted px-5 py-3"
												>
													<span className="overflow-hidden text-ellipsis text-nowrap border-b-2 text-right text-body-sm text-muted-foreground">
														{user.username} {pretty(user.hours)}
													</span>
													<span className="overflow-hidden text-ellipsis text-right text-body-sm text-muted-foreground">
														{user.starting}
													</span>
													<span className="overflow-hidden text-ellipsis text-right text-body-sm text-muted-foreground">
														{user.stoping}
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
			) : data.status === 'error' ? (
				<ErrorList errors={['There was an error parsing the results']} />
			) : null}
		</>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}

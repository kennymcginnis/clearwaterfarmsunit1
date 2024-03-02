import { json, redirect, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Card, CardContent } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon'
import { prisma } from '#app/utils/db.server.ts'
import { formatDates } from '#app/utils/misc'
import { UserScheduleEditor, action } from './__schedule-editor'
import { UserScheduleTimeline } from './__schedule-timeline'

export { action }
export async function loader({ params }: LoaderFunctionArgs) {
	if (!params?.date) {
		return redirect('/schedules')
	}

	const user = await prisma.user.findFirstOrThrow({
		select: {
			id: true,
			username: true,
			defaultHours: true,
			defaultHead: true,
			restricted: true,
			restriction: true,
			ports: {
				select: {
					ditch: true,
					position: true,
					entry: true,
				},
			},
		},
		where: {
			username: params.username,
		},
	})

	const schedule = await prisma.schedule.findFirstOrThrow({
		select: {
			id: true,
			state: true,
			source: true,
		},
		where: { date: params.date },
	})

	const userSchedule = await prisma.userSchedule.findMany({
		select: {
			ditch: true,
			hours: true,
			head: true,
			start: true,
			stop: true,
		},
		where: {
			user: { username: params.username },
			scheduleId: schedule.id,
		},
	})

	const userSchedules = userSchedule.map(us => ({ ...us, schedule: formatDates({ start: us.start, stop: us.stop }) }))
	for (const port of user.ports) {
		const found = userSchedules.some(us => us.ditch === port.ditch)
		if (!found) {
			userSchedules.push({
				ditch: port.ditch,
				hours: user.defaultHours,
				head: user.defaultHead,
				start: null,
				stop: null,
				schedule: [],
			})
		}
	}

	return json({ user, schedule, userSchedules })
}

export default function UserSchedule() {
	const { user, schedule, userSchedules } = useLoaderData<typeof loader>()

	return (
		<div className="m-auto flex h-full w-[50%] min-w-[350px] flex-col content-between gap-4 p-4">
			{userSchedules.map(userSchedule => {
				switch (schedule.state) {
					case 'open':
						return (
							<UserScheduleEditor
								key={`schedule-${userSchedule.ditch}`}
								user={user}
								schedule={schedule}
								userSchedule={userSchedule}
							/>
						)
					case 'closed':
						return (
							<UserScheduleTimeline key={`timeline-${userSchedule.ditch}`} user={user} userSchedule={userSchedule} />
						)
				}
				return (
					<div key={`locked-${userSchedule.ditch}`}>
						<Card>
							<CardContent>
								<Icon name="lock-closed" className="mb-1 mr-2 scale-100 max-md:scale-125"></Icon>
								This Schedule has not yet been opened.
							</CardContent>
						</Card>
					</div>
				)
			})}
		</div>
	)
}

export const meta: MetaFunction<null, { 'routes/schedule+/$date_': typeof loader }> = ({ params }) => {
	return [
		{ title: `Irrigation ${params.date} | Clearwater Farms 1` },
		{
			name: 'description',
			content: `Irrigation for ${params.date} Clearwater Farms 1`,
		},
	]
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => <p>No schedule with the id "{params.scheduleId}" exists</p>,
			}}
		/>
	)
}

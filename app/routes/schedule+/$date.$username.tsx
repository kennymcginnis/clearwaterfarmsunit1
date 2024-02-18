import { json, redirect, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { FormatDates } from '#app/utils/misc'
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
			open: true,
			closed: true,
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

	const userSchedules = userSchedule.map(us => ({ ...us, schedule: FormatDates({ start: us.start, stop: us.stop }) }))

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
		<div className="flex h-full flex-col content-between gap-4 p-4">
			{userSchedules.map(userSchedule => {
				if (schedule.open) {
					return (
						<UserScheduleEditor
							key={`schedule-${userSchedule.ditch}`}
							user={user}
							scheduleId={schedule.id}
							userSchedule={userSchedule}
						/>
					)
				}
				if (schedule.closed) {
					return <UserScheduleTimeline key={`timeline-${userSchedule.ditch}`} user={user} userSchedule={userSchedule} />
				}
				return <div key={`locked-${userSchedule.ditch}`}>Locked</div>
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

import { json, redirect, type LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { format } from 'date-fns'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { UserDitchSchedule, action } from './__schedule-editor'
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
		where: { user: { username: params.username }, scheduleId: schedule.id },
	})

	return json({ user, schedule, userSchedule })
}

export default function UserScheduleEditor() {
	const data = useLoaderData<typeof loader>()

	if (data.schedule.open) {
		return (
			<div className="flex h-full w-full flex-row gap-x-16 overflow-y-auto overflow-x-hidden px-10 pt-12">
				{data.user.ports.map(port => (
					<UserDitchSchedule key={port.ditch} port={port} data={data} />
				))}
			</div>
		)
	}
	if (data.schedule.closed) {
		const pretty = (hours: number | null) =>
			!hours ? '' : hours === 1 ? '(1-hour)' : hours % 1 === 0 ? `(${hours}-hours)` : `(${hours}-hrs)`

		const starting = (start: string | null) => (start ? format(new Date(start), 'MMM do h:mmaaa') : '')
		const stoping = (stop: string | null) => (stop ? format(new Date(stop), 'MMM do h:mmaaa') : '')

		return (
			<div className="flex h-full w-full flex-row gap-x-16 overflow-y-auto overflow-x-hidden px-10 pt-12">
				{data.userSchedule.map(us => (
					<div key={us.ditch} className="flex flex-col">
						<span className="overflow-hidden text-ellipsis text-nowrap border-b-2 text-right text-body-sm text-muted-foreground">
							{data.user.username} {pretty(us.hours)}
						</span>
						<span className="overflow-hidden text-ellipsis text-right text-body-sm text-muted-foreground">
							{starting(us.start)}
						</span>
						<span className="overflow-hidden text-ellipsis text-right text-body-sm text-muted-foreground">
							{stoping(us.stop)}
						</span>
					</div>
				))}
			</div>
		)
	}
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

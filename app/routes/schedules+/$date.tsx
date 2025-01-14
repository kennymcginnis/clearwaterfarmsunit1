import { invariantResponse } from '@epic-web/invariant'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { type MetaFunction, Link, useLoaderData, NavLink } from '@remix-run/react'
import { formatDistanceToNow } from 'date-fns'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { floatingToolbarClassName } from '#app/components/floating-toolbar.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { action } from '#app/routes/schedule+/actions.server'
import { prisma } from '#app/utils/db.server.ts'
import { useOptionalAdminUser } from '#app/utils/user.ts'
import { DialogCloseSchedule } from './__close-schedule-dialog'
import { ScheduleActionButton } from './__schedule-action-button'
export { action }

export async function loader({ params }: ActionFunctionArgs) {
	const schedule = await prisma.schedule.findFirst({
		select: {
			id: true,
			date: true,
			deadline: true,
			source: true,
			costPerHour: true,
			state: true,
			updatedAt: true,
		},
		where: { date: params.date },
	})
	invariantResponse(schedule, `Schedule not found for ${params.date}`, { status: 404 })

	const anythingOpen = await prisma.schedule.findFirst({
		select: { id: true },
		where: { state: 'open' },
	})
	const date = new Date(schedule.updatedAt)
	const timeAgo = formatDistanceToNow(date)

	const { _min, _max } = await prisma.userSchedule.aggregate({
		_min: { start: true },
		_max: { stop: true },
		where: { scheduleId: schedule.id },
	})

	return json({
		schedule,
		timeAgo,
		canOpen: !['open', 'closed'].includes(schedule.state) && !anythingOpen,
		canClose: schedule.state === 'locked' && !!_min.start && !!_max.stop,
	})
}

export default function ScheduleRoute() {
	const { schedule, timeAgo, canOpen, canClose } = useLoaderData<typeof loader>()
	const adminUser = useOptionalAdminUser()

	const state = schedule.state.toLowerCase()
	const isClosed = state === 'closed'
	const canEdit = state !== 'closed'
	const canDelete = state === 'pending'
	const canLock = state === 'open'
	const generateLink = state === 'locked'

	return (
		<div className="absolute inset-0 flex flex-col px-10">
			<div className="mt-6 flex w-full flex-row items-stretch gap-2">
				<Button asChild variant="outline" className="px-10">
					<NavLink to={`/schedule/${schedule.date}/signup`}>
						<Icon name="pencil-2" className="mr-1 scale-125 max-md:scale-150">
							<span className="max-md:hidden">Sign-up</span>
						</Icon>
					</NavLink>
				</Button>
				<Button asChild variant="outline" className="px-10">
					<NavLink to={`/schedule/${schedule.date}/timeline`}>
						<Icon name="calendar" className="mr-1 scale-125 max-md:scale-150">
							<span className="max-md:hidden">Timeline</span>
						</Icon>
					</NavLink>
				</Button>
			</div>
			<h2 className="mb-2 pt-4 text-h2 lg:mb-6">Irrigation Schedule: {schedule.date}</h2>
			<div className={`${adminUser ? 'pb-24' : 'pb-12'} overflow-y-auto`}>
				<p className="whitespace-break-spaces text-sm md:text-lg">Deadline for Sign-Up: {schedule.deadline}</p>
				<p className="whitespace-break-spaces text-sm capitalize md:text-lg">Water source: {schedule.source} Water</p>
				<p className="whitespace-break-spaces text-sm md:text-lg">Cost Per Hour: {schedule.costPerHour}</p>
			</div>

			{adminUser ? (
				<div className={floatingToolbarClassName}>
					<span className="text-sm text-foreground/90 max-[524px]:hidden">
						<Icon name="clock" className="scale-125">
							<span className="overflow-ellipsis text-nowrap">{timeAgo} ago</span>
						</Icon>
					</span>
					<div className="grid flex-1 grid-cols-2 justify-end gap-1 min-[525px]:flex md:gap-2">
						{canDelete ? (
							<ScheduleActionButton
								id={schedule.id}
								icon="trash"
								value="delete-schedule"
								text="Delete"
								variant="destructive"
							/>
						) : null}
						{isClosed ? (
							<>
								<Button>
									<Link reloadDocument to={`/resources/download/crossovers/${schedule.date}`}>
										<Icon name="download">Crossovers</Icon>
									</Link>
								</Button>
								<Button>
									<Link reloadDocument to={`/resources/download/quickbooks/${schedule.date}`}>
										<Icon name="download">Quickbooks</Icon>
									</Link>
								</Button>
								<ScheduleActionButton
									id={schedule.id}
									icon="envelope-closed"
									value="closed-emails"
									text="Send Emails"
									variant="default"
								/>
								{/* <ScheduleActionButton
									id={schedule.id}
									icon="envelope-closed"
									value="test-email"
									text="Test Email"
									variant="destructive"
								/> */}
							</>
						) : null}
						{canClose ? <DialogCloseSchedule id={schedule.id} /> : null}
						{generateLink ? (
							<Button asChild variant="default">
								<NavLink to={`/schedule/${schedule.date}/generate`}>
									<Icon name="activity-log" className="scale-125 max-md:scale-150">
										<span className="max-md:hidden">Generate</span>
									</Icon>
								</NavLink>
							</Button>
						) : null}
						{canOpen ? (
							<ScheduleActionButton
								id={schedule.id}
								icon="lock-open-1"
								value="open-schedule"
								text="Open Sign-up"
								variant="secondary"
							/>
						) : null}
						{canLock ? (
							<ScheduleActionButton
								id={schedule.id}
								icon="lock-closed"
								value="lock-schedule"
								text="Lock Scheduling"
								variant="secondary"
							/>
						) : null}
						{canEdit ? (
							<Button asChild className="min-[525px]:max-md:aspect-square min-[525px]:max-md:px-0">
								<Link to="edit">
									<Icon name="pencil-1" className="scale-125 max-md:scale-150">
										<span className="max-md:hidden">Edit</span>
									</Icon>
								</Link>
							</Button>
						) : null}
					</div>
				</div>
			) : null}
		</div>
	)
}

export const meta: MetaFunction<null, { 'routes/schedules+/$date': typeof loader }> = ({ params }) => {
	return [
		{ title: `Irrigation Schedules | ${params.date}` },
		{
			name: 'description',
			content: `Clearwater Farms 1 Irrigation Schedules`,
		},
	]
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				403: () => <p>You are not allowed to do that</p>,
				404: ({ params }) => <p>No schedule with the id "{params.scheduleId}" exists</p>,
				406: () => <p>Only one schedule can be open at a time.</p>,
			}}
		/>
	)
}

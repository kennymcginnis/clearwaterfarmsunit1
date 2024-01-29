import { parse } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { type MetaFunction, Link, useLoaderData, NavLink } from '@remix-run/react'
import { formatDistanceToNow } from 'date-fns'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { floatingToolbarClassName } from '#app/components/floating-toolbar.tsx'
import { ScheduleActionButton } from '#app/components/ScheduleActionButton'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { validateCSRF } from '#app/utils/csrf.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { requireUserWithRole, userHasRole } from '#app/utils/permissions.ts'
import { generatePublicId } from '#app/utils/public-id'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { useOptionalUser } from '#app/utils/user.ts'
import { DialogCloseSchedule } from './DialogCloseSchedule'

export async function loader({ params }: ActionFunctionArgs) {
	const schedule = await prisma.schedule.findFirst({
		select: {
			id: true,
			date: true,
			deadline: true,
			source: true,
			costPerHour: true,
			open: true,
			closed: true,
			updatedAt: true,
		},
		where: { date: params.date },
	})

	invariantResponse(schedule, `Schedule not found for ${params.date}`, {
		status: 404,
	})

	const date = new Date(schedule.updatedAt)
	const timeAgo = formatDistanceToNow(date)

	return json({
		schedule,
		timeAgo,
	})
}

const ActionFormSchema = z.object({
	intent: z.string(),
	scheduleId: z.string(),
})

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserWithRole(request, 'admin')

	const formData = await request.formData()
	await validateCSRF(formData, request.headers)
	const submission = parse(formData, {
		schema: ActionFormSchema,
	})

	console.dir({ submission })

	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}
	if (!submission.value) {
		return json({ status: 'error', submission } as const, { status: 400 })
	}

	const { scheduleId } = submission.value
	const schedule = await prisma.schedule.findFirst({
		select: { id: true, date: true, costPerHour: true },
		where: { id: scheduleId },
	})
	invariantResponse(schedule, 'Not found', { status: 404 })

	switch (submission.payload.intent) {
		case 'delete-schedule':
			await prisma.schedule.delete({ where: { id: schedule.id } })
			return redirectWithToast(`/schedules`, {
				type: 'success',
				title: 'Success',
				description: 'Your schedule has been deleted.',
			})

		case 'open-schedule':
			const alreadyOpen = await prisma.schedule.findFirst({
				select: { id: true, date: true },
				where: { open: true },
			})
			if (alreadyOpen) {
				return json({ status: 'error', schedule } as const, { status: 406 })
			}
			const updated = await prisma.schedule.update({
				select: { id: true, date: true },
				where: { id: schedule.id },
				data: {
					open: true,
					updatedBy: userId,
				},
			})
			return redirectWithToast(`/schedules/${updated.date}`, {
				type: 'success',
				title: 'Success',
				description: 'Your schedule has been deleted.',
			})

		case 'close-schedule':
			const userSchedules = await prisma.userSchedule.findMany({
				select: { userId: true, hours: true },
				where: { scheduleId: schedule.id },
			})
			for (const userSchedule of userSchedules) {
				if (userSchedule.hours > 0) {
					await prisma.transaction.create({
						data: {
							id: generatePublicId(),
							userId: userSchedule.userId,
							credit: userSchedule.hours * schedule.costPerHour,
							date: schedule.date,
							note: `${userSchedule.hours} hours at $${schedule.costPerHour} per hour`,
							createdBy: userId,
						},
					})
				}
			}
			await prisma.schedule.update({
				where: { id: schedule.id },
				data: {
					open: false,
					closed: true,
					updatedBy: userId,
				},
			})
			return redirectWithToast(`/schedules`, {
				type: 'success',
				title: 'Success',
				description: `${userSchedules.length} Debits created. Schedule closed.`,
			})
	}
}

export default function ScheduleRoute() {
	const data = useLoaderData<typeof loader>()
	const user = useOptionalUser()
	const adminUser = userHasRole(user, 'admin')

	const canDelete = !data.schedule.open && !data.schedule.closed
	const canOpen = !data.schedule.open && !data.schedule.closed
	const canClose = data.schedule.open && !data.schedule.closed
	const canEdit = !data.schedule.closed

	return (
		<div className="absolute inset-0 flex flex-col px-10">
			<h2 className="mb-2 pt-12 text-h2 lg:mb-6">Irrigation Schedule beginning: {data.schedule.date}</h2>
			<div className={`${adminUser ? 'pb-24' : 'pb-12'} overflow-y-auto`}>
				<p className="whitespace-break-spaces text-sm md:text-lg">Deadline for signing up: {data.schedule.deadline}</p>
				<p className="whitespace-break-spaces text-sm md:text-lg">Water source: {data.schedule.source}</p>
				<p className="whitespace-break-spaces text-sm md:text-lg">Cost per hour: {data.schedule.costPerHour}</p>
			</div>

			{adminUser ? (
				<div className={floatingToolbarClassName}>
					<span className="text-sm text-foreground/90 max-[524px]:hidden">
						<Icon name="clock" className="scale-125">
							{data.timeAgo} ago
						</Icon>
					</span>
					<div className="grid flex-1 grid-cols-2 justify-end gap-2 min-[525px]:flex md:gap-4">
						{canDelete ? (
							<ScheduleActionButton
								id={data.schedule.id}
								icon="trash"
								value="delete-schedule"
								text="Delete"
								variant="destructive"
							/>
						) : null}
						{canOpen ? (
							<ScheduleActionButton
								id={data.schedule.id}
								icon="lock-open-1"
								value="open-schedule"
								text="Open for Sign-up"
								variant="default"
							/>
						) : null}
						{canClose ? <DialogCloseSchedule id={data.schedule.id} /> : null}
						{canClose ? (
							<Button asChild variant="default">
								<NavLink to={`/schedule/${data.schedule.date}/sign-up`}>
									<Icon name="magnifying-glass" className="scale-125 max-md:scale-150">
										<span className="max-md:hidden">Sign-up</span>
									</Icon>
								</NavLink>
							</Button>
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

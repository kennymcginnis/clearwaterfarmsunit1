import { useForm } from '@conform-to/react'
import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs, type MetaFunction, type ActionFunctionArgs } from '@remix-run/node'
import { Form, useLoaderData } from '@remix-run/react'
import { formatDistance, formatDistanceStrict, isBefore, isAfter } from 'date-fns'
import { useState } from 'react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Badge } from '#app/components/ui/badge'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import CrossoversAdminPanel from '#app/routes/schedule+/CrossoversAdminPanel.tsx'
import { getUserId } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server.ts'
import { formatDate, formatDates, getDateTimeFormat } from '#app/utils/misc'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { backgroundColor, crossovers } from '#app/utils/user-schedule.ts'
import { useOptionalAdminUser } from '#app/utils/user.ts'

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
	distanceToNow: string
	duty: string
	isCurrentSchedule: boolean
	isCurrentUser: boolean
	isCurrentVolunteer: boolean
	acknowledged?: boolean | null
	trained?: boolean | null
	volunteer?: string | null
	volunteerTrained?: boolean | null
}

export const SearchResultsSchema = z.array(
	z.object({
		userId: z.string(),
		display: z.string(),
		quickbooks: z.string().optional(),
		trained: z.boolean(),
		portId: z.string(),
		ditch: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(9)),
		position: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(99)),
		entry: z.string(),
		address: z.number().nullable(),
		section: z.string(),
		hours: z.preprocess(x => (x ? x : 0), z.coerce.number().multipleOf(0.5).min(0).max(36)),
		start: z.date().nullable(),
		stop: z.date().nullable(),
		first: z.boolean().optional().nullable(),
		crossover: z.boolean().optional().nullable(),
		acknowledgeFirst: z.boolean().optional().nullable(),
		acknowledgeCrossover: z.boolean().optional().nullable(),
		volunteerFirst: z.string().optional().nullable(),
		volunteerFirstId: z.string().optional().nullable(),
		volunteerCrossover: z.string().optional().nullable(),
		volunteerCrossoverId: z.string().optional().nullable(),
		firstVolunteerTrained: z.boolean().optional().nullable(),
		crossoverVolunteerTrained: z.boolean().optional().nullable(),
	}),
)

export async function loader({ request, params }: LoaderFunctionArgs) {
	const currentUser = await getUserId(request)

	// @ts-ignore
	const users: {
		id: string
		quickbooks: string
	}[] = await prisma.user.findMany({
		select: { id: true, quickbooks: true },
		where: { active: true, quickbooks: { not: null } },
		orderBy: { quickbooks: 'asc' },
	})

	const schedule = await prisma.schedule.findFirstOrThrow({
		select: { id: true, date: true, start: true, stop: true },
		where: { date: params.date },
	})
	invariantResponse(schedule?.id, 'Schedule Not found', { status: 404 })

	const time = getDateTimeFormat(request).format(new Date())

	const rawUsers = await prisma.$queryRaw`
    SELECT User.id AS userId, User.display, User.quickbooks, User.trained, 
           Port.id AS portId, Port.ditch, Port.position, Port.entry, Port.section, Port.address, 
           UserSchedule.hours, UserSchedule.start, UserSchedule.stop,
           UserSchedule.first, UserSchedule.crossover,
					 UserSchedule.acknowledgeFirst, UserSchedule.acknowledgeCrossover,
					 v1.id AS volunteerFirstId, v2.id AS volunteerCrossoverId,
					 v1.quickbooks AS volunteerFirst, v2.quickbooks AS volunteerCrossover,
					 v1.trained AS firstVolunteerTrained, v2.trained AS crossoverVolunteerTrained
      FROM User
     INNER JOIN Port ON User.id = Port.userId
      LEFT JOIN UserSchedule
        ON User.id = UserSchedule.userId
       AND Port.id = UserSchedule.portId
		  LEFT JOIN User v1
 			  ON UserSchedule.volunteerFirst = v1.id
 			LEFT JOIN User v2
			  ON UserSchedule.volunteerCrossover = v2.id
     WHERE User.active
		   AND UserSchedule.scheduleId = ${schedule.id}
       AND (UserSchedule.first OR UserSchedule.crossover)
     ORDER BY UserSchedule.start ASC
  `

	const result = SearchResultsSchema.safeParse(rawUsers)
	if (!result.success)
		return json(
			{
				users,
				currentUser,
				status: 'error',
				schedule: { id: null, date: null, start: null, stop: null },
				userSchedules: [],
			} as const,
			{ status: 400 },
		)

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

	const userSchedules: UserScheduleType[] = []

	result.data.forEach(userSchedule => {
		// user groupings
		const { start: startDate, stop, ditch, entry } = userSchedule
		const { isCurrentSchedule, distanceToNow } = calcDistanceToNow(startDate, stop)
		const duties = crossovers[ditch][entry]
		const start = formatDate(startDate)
		const isCurrentUser = userSchedule.userId === currentUser

		if (userSchedule.first) {
			userSchedules.push({
				...userSchedule,
				acknowledged: userSchedule.acknowledgeFirst,
				volunteer: userSchedule.volunteerFirst,
				volunteerTrained: userSchedule.firstVolunteerTrained,
				duty: duties.first,
				crossover: false,
				start,
				isCurrentSchedule,
				isCurrentUser,
				isCurrentVolunteer: currentUser ? userSchedule.volunteerFirstId === currentUser : false,
				distanceToNow,
			})
		}

		if (userSchedule.crossover) {
			userSchedules.push({
				...userSchedule,
				acknowledged: userSchedule.acknowledgeCrossover,
				volunteer: userSchedule.volunteerCrossover,
				volunteerTrained: userSchedule.crossoverVolunteerTrained,
				duty: duties.crossover,
				first: false,
				start,
				isCurrentSchedule,
				isCurrentUser,
				isCurrentVolunteer: currentUser ? userSchedule.volunteerCrossoverId === currentUser : false,
				distanceToNow,
			})
		}
	})
	return json({
		users,
		status: 'idle',
		currentUser,
		schedule: { ...schedule, schedule: formatDates({ start: schedule?.start ?? null, stop: schedule?.stop ?? null }) },
		userSchedules,
	} as const)
}

export async function action({ request }: ActionFunctionArgs) {
	const updatedBy = (await getUserId(request)) ?? 'admin'

	const formData = await request.formData()

	const userId = String(formData.get('userId'))
	const portId = String(formData.get('portId'))
	const scheduleId = String(formData.get('scheduleId'))
	if (!userId || !portId || !scheduleId) return new Response('Missing parameters', { status: 400 })

	const type = String(formData.get('type'))
	const intent = String(formData.get('intent'))

	let data = {}
	switch (intent) {
		case 'acknowledge':
		case 'assistance':
			const acknowledged = intent === 'acknowledge'
			switch (type) {
				case 'first':
					data = { acknowledgeFirst: acknowledged, updatedBy }
					break
				case 'crossover':
					data = { acknowledgeCrossover: acknowledged, updatedBy }
					break
				default:
					return new Response('Invalid type, expected `first` or `crossover`', { status: 400 })
			}
			break
		case 'volunteer':
			const volunteerId = String(formData.get('volunteerId'))
			if (!volunteerId) return new Response('Missing parameters', { status: 400 })
			switch (type) {
				case 'first':
					data = { volunteerFirst: volunteerId, updatedBy }
					break
				case 'crossover':
					data = { volunteerCrossover: volunteerId, updatedBy }
					break
				default:
					return new Response('Invalid type, expected `first` or `crossover`', { status: 400 })
			}
			break
		case 'unvolunteer':
			switch (type) {
				case 'first':
					data = { volunteerFirst: null, updatedBy }
					break
				case 'crossover':
					data = { volunteerCrossover: null, updatedBy }
					break
				default:
					return new Response('Invalid type, expected `first` or `crossover`', { status: 400 })
			}
			break
		default:
			return new Response('Invalid intent, expected `acknowledge`, `assistance`, or `volunteer`', { status: 400 })
	}
	await prisma.userSchedule.update({
		data,
		where: { userId_scheduleId_portId: { userId, scheduleId, portId } },
	})

	return redirectWithToast('', {
		type: 'success',
		title: 'Success',
		description: 'Your response has been uploaded.',
	})
}

export default function TimelineRoute() {
	const { users, currentUser, status, schedule, userSchedules } = useLoaderData<typeof loader>()

	const userIsAdmin = useOptionalAdminUser()
	const [showAdminButtons, setShowAdminButtons] = useState(false)
	const toggleAdminButtons = () => setShowAdminButtons(!showAdminButtons)
	if (!schedule || status !== 'idle') return null

	return (
		<div className="h-vh mx-auto flex min-w-[80%] flex-col gap-1 p-1">
			<div className="container my-8 flex flex-col items-center justify-center gap-6">
				<h1 className="text-center text-h1">Gate Changes & Crossovers | {schedule.date}</h1>
				<h2 className="text-h2">Acknowledgements and Volunteer Signup</h2>
				<h3 className="text-center text-h3">{schedule.schedule.join(' ─ ')}</h3>
			</div>
			<div
				id="title-row"
				className="border-1 my-1 flex w-full justify-center rounded-lg border-secondary-foreground bg-sky-800 p-2 text-2xl text-white"
			>
				<div className="flex-grow" />
				<Icon name="droplets" className="mx-1 h-8 w-8 p-1" aria-hidden="true" />
				Gate Changes & Crossovers:
				<Icon name="droplet" className="mx-1 h-8 w-8 p-1" aria-hidden="true" />
				<div className="flex-1" />
				{userIsAdmin ? (
					<Button variant="outline" className="w-48 text-secondary-foreground" onClick={toggleAdminButtons}>
						{`${showAdminButtons ? '▲ Hide' : '▼ Show'} Admin Buttons`}
					</Button>
				) : null}
			</div>
			{userSchedules.map(userSchedule => (
				<UserCard
					key={`${userSchedule.start}`}
					users={users}
					currentUser={currentUser}
					schedule={schedule}
					userSchedule={userSchedule}
					showAdminButtons={showAdminButtons}
				/>
			))}
		</div>
	)
}

function UserCard({
	users,
	currentUser,
	schedule,
	userSchedule: {
		userId,
		portId,
		quickbooks,
		trained,
		duty,
		start,
		first,
		isCurrentSchedule,
		isCurrentUser,
		isCurrentVolunteer,
		distanceToNow,
		acknowledged,
		volunteer,
		volunteerTrained,
	},
	showAdminButtons,
}: {
	users: { id: string; quickbooks: string }[]
	schedule: { id: string; date: string }
	currentUser: string | null
	userSchedule: UserScheduleType
	showAdminButtons: boolean
}) {
	const type = first ? 'first' : 'crossover'
	const showTrained = false

	const foregroundColor = ({ trained, acknowledged }: { trained?: boolean | null; acknowledged?: boolean | null }) => {
		if (trained) return 'text-blue-700 border-blue-700'
		if (trained === false) return 'text-yellow-700 border-yellow-700'
		if (acknowledged) return 'text-green-700 border-green-700'
		if (acknowledged === false) return 'text-red-700 border-red-700'
		return 'text-yellow-700 border-yellow-700'
	}
	const borderColor = ({ acknowledged, volunteer }: { acknowledged?: boolean | null; volunteer?: string | null }) => {
		if (acknowledged) return 'border-2 border-green-700'
		if (volunteer) return 'border-2 border-blue-700'
		if (acknowledged === false) return 'border-2 border-red-700'
		return 'border-1 border-secondary-foreground'
	}
	const background = ({
		isCurrentSchedule,
		isCurrentUser,
		first,
	}: {
		isCurrentSchedule: boolean
		isCurrentUser: boolean
		first?: boolean | null
	}) => {
		if (isCurrentSchedule) return 'bg-sky-800 text-white'
		if (isCurrentUser) return 'bg-secondary'
		if (first) return 'bg-secondary/20'
		return ''
	}

	const [form] = useForm({ id: `userId=${userId}&scheduleId=${schedule.id}&portId=${portId}` })
	return (
		<div
			id="user-row"
			className={`flex w-full flex-row items-start justify-between rounded-lg p-2 md:flex-row md:items-center ${borderColor({ acknowledged, volunteer })} ${background({ isCurrentSchedule, isCurrentUser, first })}`}
		>
			<div id="column-wrapper" className="mb-2 flex w-full flex-col">
				{(showAdminButtons || (volunteer && !acknowledged)) && (
					<div
						id="volunteer-row"
						className="flex w-full flex-row items-center justify-between border-b-2 border-secondary-foreground pb-2"
					>
						{volunteer && !acknowledged ? (
							<strong id="volunteer-name" className="mb-1 overflow-hidden text-ellipsis text-nowrap">
								<div className={`${isCurrentSchedule ? 'text-white' : 'text-blue-700'}`}>[VOLUNTEER]: {volunteer}</div>
							</strong>
						) : (
							<div></div>
						)}
						{showTrained && (
							<Badge
								id="volunteerTrained"
								className={`mx-1 h-8 ${backgroundColor('default')} ${foregroundColor({ trained })} capitalize`}
								variant="outline"
							>
								<Icon
									name={trained ? 'diploma' : 'exclamation-triangle'}
									className={`h-6 w-6 pr-1 pt-1 ${foregroundColor({ trained })}`}
									aria-hidden="true"
								/>
								<div>{volunteerTrained ? 'Trained' : 'Not Trained'}</div>
							</Badge>
						)}
						{showAdminButtons && (
							<CrossoversAdminPanel
								users={users}
								userId={userId}
								scheduleId={schedule.id}
								portId={portId}
								type={type}
							/>
						)}
					</div>
				)}
				<div id="user-details" className="flex h-full w-full flex-col justify-between p-2 md:flex-row md:items-center">
					<div id="quickbooks-duty" className="flex w-full flex-col items-start justify-between">
						<div id="name-and-trained" className="flex flex-row">
							<strong
								id="quickbooks"
								className={`mb-1 overflow-hidden text-ellipsis text-nowrap underline ${acknowledged ? 'text-green-700 decoration-green-700' : acknowledged === false ? 'text-red-700 decoration-red-700' : ''}`}
							>
								{quickbooks}
							</strong>
							<Badge
								id="acknowledged"
								className={`ml-2 mr-1 h-8 ${first || isCurrentSchedule || isCurrentUser ? 'bg-background' : 'bg-muted/40'}  ${foregroundColor({ acknowledged })} capitalize`}
								variant="outline"
							>
								<Icon
									name={
										acknowledged ? 'check-circled' : acknowledged === false ? 'cross-circled' : 'exclamation-triangle'
									}
									className={`h-6 w-6 py-0.5 ${foregroundColor({ acknowledged })}`}
									aria-hidden="true"
								/>
								<div className="text-ellipsis text-nowrap">
									{acknowledged ? 'Acknowledged' : acknowledged === false ? 'Requests Help' : 'No Response'}
								</div>
							</Badge>
							{acknowledged && showTrained && (
								<Badge
									id="trained"
									className={`mx-1 h-8 ${backgroundColor('default')} ${foregroundColor({ trained })} capitalize`}
									variant="outline"
								>
									<Icon
										name={trained ? 'diploma' : 'exclamation-triangle'}
										className={`h-6 w-6 pr-1 pt-1 ${foregroundColor({ trained })}`}
										aria-hidden="true"
									/>
									<div>{trained ? 'Trained' : 'Not Trained'}</div>
								</Badge>
							)}
						</div>
						<div id="badges-and-duty" className="flex h-full w-full flex-row items-center gap-1">
							<Badge
								id="first-badge"
								className={`${first ? 'ml-[40px]' : 'ml-[10px]'} mr-1 h-6 capitalize ${backgroundColor(type)} ${isCurrentSchedule && 'text-white'}`}
								variant="outline"
							>
								{type}
							</Badge>
							<div>{duty}</div>
						</div>
					</div>
					{currentUser && (
						<div id="buttons-row" className="flex min-w-64 flex-row justify-end">
							<Form method="POST" {...form.props}>
								<input type="hidden" name="userId" value={userId} />
								<input type="hidden" name="portId" value={portId} />
								<input type="hidden" name="scheduleId" value={schedule.id} />
								<input type="hidden" name="type" value={type} />
								<input type="hidden" name="volunteerId" value={currentUser} />
								{isCurrentUser && !acknowledged && (
									<Button
										type="submit"
										name="intent"
										value="acknowledge"
										variant="outline"
										className="border-2 border-green-700 text-primary shadow-sm shadow-gray-700"
									>
										Acknowledge
									</Button>
								)}
								{isCurrentUser && acknowledged !== false && (
									<Button
										type="submit"
										name="intent"
										value="assistance"
										variant="outline"
										className="ml-1 w-32 border-2 border-red-700 text-primary shadow-sm shadow-gray-700"
									>
										Request Help
									</Button>
								)}
								{!isCurrentUser && volunteer === null && acknowledged !== true && (
									<Button
										type="submit"
										name="intent"
										value="volunteer"
										variant="outline"
										className="w-40 border-2 border-blue-700 text-primary shadow-sm shadow-gray-700"
									>
										Volunteer to Help
									</Button>
								)}
								{isCurrentVolunteer && (
									<Button
										type="submit"
										name="intent"
										value="unvolunteer"
										variant="outline"
										className="w-40 border-2 border-red-700 text-primary shadow-sm shadow-gray-700"
									>
										Remove Volunteer
									</Button>
								)}
							</Form>
						</div>
					)}

					<div
						id="distance-start"
						className="m-2 flex h-full min-w-60 flex-row items-start justify-center border-t-[1px] border-secondary-foreground pl-2 sm:flex-col md:mt-0 md:border-t-0"
					>
						<div id="distance-to-now" className="min-w-60 overflow-hidden text-ellipsis pr-2 text-body-sm">
							{distanceToNow}
						</div>
						<div id="start" className="min-w-44 overflow-hidden text-ellipsis text-body-sm">
							{String(start)}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export const meta: MetaFunction<null, { 'routes/crossovers': typeof loader }> = () => {
	return [
		{ title: 'Irrigation | Gate Changes & Crossovers' },
		{
			name: 'description',
			content: `Clearwater Farms 1 Irrigation Timeline`,
		},
	]
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}

import { useForm } from '@conform-to/react'
import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs, type MetaFunction, type ActionFunctionArgs } from '@remix-run/node'
import { Form, useLoaderData, useSubmit } from '@remix-run/react'
import {
	formatDistance,
	formatDistanceStrict,
	isBefore,
	isAfter,
	addHours,
	addMinutes,
	subMinutes,
	parseISO,
	startOfDay,
} from 'date-fns'
import { useState } from 'react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Badge } from '#app/components/ui/badge'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { CrossoversAdminPanel, CrossoverSortingButtons } from '#app/routes/schedule+/$date+/CrossoversAdminPanel.tsx'
import { getUserId } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server.ts'
import { cn, formatDate, formatDates, getDateTimeFormat } from '#app/utils/misc'
import { backgroundColor, crossoverDuties } from '#app/utils/user-schedule.ts'
import { useOptionalAdminUser } from '#app/utils/user.ts'
import { Input } from '#app/components/ui/input.tsx'

export type UserScheduleType = {
	crossoverId: string
	order: number
	userId: string | null
	display?: string | null
	quickbooks?: string | null
	ditch: number
	entry: string
	hours: number | bigint | null
	startString: string | null
	distanceToNow: string
	duty: string
	dutyStart?: number
	dutyStartString: string | null
	dutyDetail: string
	dutyNotes?: string | null
	acknowledged?: boolean | null
	volunteer?: string | null
	trained?: boolean | null
	training?: boolean | null
	isCurrentSchedule: boolean
	isCurrentUser: boolean
	isCurrentVolunteer: boolean
	isLocked: boolean
}

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

	const crossovers = await prisma.crossover.findMany({
		select: {
			id: true,
			order: true,
			userId: true,
			user: { select: { display: true, quickbooks: true, trained: true } },
			dutyStart: true,
			dutyNotes: true,
			ditch: true,
			entry: true,
			duty: true,
			acknowledge: true,
			volunteerId: true,
			volunteer: { select: { quickbooks: true } },
			training: true,
			hours: true,
			start: true,
			stop: true,
		},
		where: { scheduleId: schedule.id },
		orderBy: { order: 'asc' },
	})
	invariantResponse(crossovers.length, 'No UserSchedules found', { status: 404 })

	const calcDistanceToNow = (
		start: Date | null,
		stop: Date | null,
	): { isCurrentSchedule: boolean; distanceToNow: string } => {
		const time = getDateTimeFormat(request).format(new Date())
		if (!start) return { isCurrentSchedule: false, distanceToNow: '' }
		const finished = isBefore(stop ?? start, time)
		if (finished) {
			const distance = formatDistance(stop ?? start, time, { addSuffix: true })
			return { isCurrentSchedule: false, distanceToNow: `Finished ${distance}` }
		} else {
			const isCurrentSchedule = stop ? isBefore(start, time) && isAfter(stop, time) : false
			if (isCurrentSchedule && stop) {
				const distance = formatDistanceStrict(time, stop)
				return { isCurrentSchedule, distanceToNow: `Irrigating another ${distance}` }
			} /*Starts in */ else {
				const distance = formatDistance(start, time, { addSuffix: true })
				return { isCurrentSchedule, distanceToNow: `Starts ${distance}` }
			}
		}
	}

	const startsInLessThan48Hours = (date: Date | null) => {
		if (!date) return false
		const now = new Date()
		const fortyEightHoursFromNow = addHours(now, 48)
		return isBefore(date, fortyEightHoursFromNow)
	}

	const userSchedules: UserScheduleType[] = crossovers.map(
		({
			id: crossoverId,
			start: startDate,
			dutyStart,
			stop,
			ditch,
			entry,
			duty,
			user,
			userId,
			volunteerId,
			volunteer,
			...crossover
		}) => ({
			crossoverId,
			...crossover,
			userId,
			...user,
			ditch,
			entry,
			duty,
			volunteer: volunteer?.quickbooks ?? null,
			dutyDetail: crossoverDuties[ditch][entry][duty],
			dutyStart: dutyStart?.getTime(),
			dutyStartString: formatDate(dutyStart),
			startString: formatDate(startDate),
			isCurrentUser: userId === currentUser,
			isCurrentVolunteer: currentUser ? volunteerId === currentUser : false,
			isLocked: startsInLessThan48Hours(startDate),
			...calcDistanceToNow(dutyStart, stop),
		}),
	)
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
	const crossoverId = String(formData.get('crossoverId'))
	if (!crossoverId) return new Response('Missing parameters', { status: 400 })
	const crossover = await prisma.crossover.findFirst({ where: { id: crossoverId } })
	if (!crossover) return new Response('Crossover not found', { status: 400 })

	let data = {}
	const intent = String(formData.get('intent'))
	switch (intent) {
		case 'acknowledge':
		case 'training':
		case 'assistance':
			const acknowledge = intent !== 'assistance'
			const training = intent === 'training'
			data = { acknowledge, training, updatedBy }
			break
		case 'volunteer':
			const volunteerId = String(formData.get('volunteerId'))
			if (!volunteerId) return new Response('Missing parameters', { status: 400 })
			data = { volunteerId, updatedBy }
			break
		case 'unvolunteer':
			data = { volunteerId: null, updatedBy }
			break

		case 'increment': {
			const order = Number(formData.get('order'))
			if (order) {
				const scheduleId = String(formData.get('scheduleId'))
				const newOrder = crossover.order + 1
				await prisma.crossover.updateMany({ data: { order }, where: { scheduleId, order: newOrder } })
				data = { order: newOrder }
			} else {
				const start = Number(formData.get('start'))
				if (start) data = { dutyStart: addMinutes(start, 5) }
			}
			break
		}
		case 'decrement': {
			const order = Number(formData.get('order'))
			if (order) {
				const scheduleId = String(formData.get('scheduleId'))
				const newOrder = crossover.order - 1
				await prisma.crossover.updateMany({ data: { order }, where: { scheduleId, order: newOrder } })
				data = { order: newOrder }
			} else {
				const start = Number(formData.get('start'))
				if (start) data = { dutyStart: subMinutes(start, 5) }
			}
			break
		}

		case 'dutyNotes':
			const dutyNotes = String(formData.get('dutyNotes'))
			data = { dutyNotes }
			break
		case 'setTime':
			const timestamp = String(formData.get('timestamp'))
			invariantResponse(timestamp, 'Invalid Timestamp', { status: 400 })
			const dutyStart = parseISO(timestamp)
			data = { dutyStart }
			break

		default:
			return new Response('Invalid intent', { status: 400 })
	}
	await prisma.crossover.update({ data, where: { id: crossoverId } })
	return null
}

export default function CrossoversRoute() {
	const { users, currentUser, status, schedule, userSchedules } = useLoaderData<typeof loader>()

	const userIsAdmin = useOptionalAdminUser()
	const [showAdminButtons, setShowAdminButtons] = useState(false)
	const toggleAdminButtons = () => setShowAdminButtons(!showAdminButtons)
	if (!schedule || status !== 'idle') return null

	return (
		<div className="h-vh mx-auto flex min-w-[80%] flex-col gap-1 p-1">
			<div className="container my-4 flex flex-col items-center justify-center gap-6">
				<h1 className="text-center text-h1">Gate Changes & Crossovers | {schedule.date}</h1>
				<h2 className="text-h2">Acknowledgements and Volunteer Signup</h2>
				<h3 className="text-center text-h3">{schedule.schedule.join(' ─ ')}</h3>
			</div>
			<div
				id="title-row"
				className="border-1 flex w-full justify-center rounded-lg border-secondary-foreground bg-sky-800 p-2 text-2xl text-white"
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
			<h5 className="mt-2 text-h5 underline">Task Confirmation and Support Options:</h5>
			{referenceKey.map((key, index) => (
				<SampleButton key={`reference-key-${index}`} {...key} />
			))}
			<h6 className="mb-2 text-h6">
				Note: These buttons will be disabled 48-hours before their designated start time.
			</h6>
			{userSchedules.map(userSchedule => (
				<UserCard
					key={userSchedule.crossoverId}
					users={users}
					scheduleId={schedule.id}
					currentUser={currentUser}
					userSchedule={userSchedule}
					showAdminButtons={showAdminButtons}
				/>
			))}
		</div>
	)

	function SampleButton({
		color,
		label,
		description,
		className,
	}: {
		color: string
		label: string
		description: string
		className?: string
	}) {
		return (
			<div id="key-row" className={cn('ml-2 flex flex-row gap-1', className)}>
				<div className="ml-1 flex flex-col justify-center whitespace-pre-wrap">
					<Button
						variant="outline"
						className={`pointer-events-none w-40 border-2 border-${color} text-primary shadow-sm shadow-gray-700 hover:bg-background`}
					>
						{label}
					</Button>
				</div>
				<div className="ml-1 flex flex-col justify-center whitespace-pre-wrap">{description}</div>
			</div>
		)
	}
}

function UserCard({
	users,
	scheduleId,
	currentUser,
	userSchedule: {
		userId,
		crossoverId,
		order,
		quickbooks,
		trained,
		duty,
		dutyStart,
		dutyStartString,
		dutyDetail,
		dutyNotes,
		startString,
		isCurrentSchedule,
		isCurrentUser,
		isCurrentVolunteer,
		isLocked,
		distanceToNow,
		acknowledged,
		volunteer,
		training,
	},
	showAdminButtons,
}: {
	users: { id: string; quickbooks: string }[]
	scheduleId: string
	currentUser: string | null
	userSchedule: UserScheduleType
	showAdminButtons: boolean
}) {
	const [form] = useForm({ id: crossoverId })
	const first = Boolean(duty === 'first')
	const submit = useSubmit()

	const handleChange = (dutyNotes: string) =>
		submit({ intent: 'dutyNotes', crossoverId, dutyNotes }, { method: 'POST' })

	const dutyStartDate = dutyStart ? new Date(dutyStart) : startOfDay(new Date())
	const getTimestamp = (ev: any): string => {
		if (!ev.target['validity'].valid) return ''
		return ev.target['value'] + ':00Z'
	}
	const handleChangeTimestamp = (ev: any) => {
		const timestamp = getTimestamp(ev)
		submit({ intent: 'setTime', crossoverId, timestamp }, { method: 'POST' })
	}

	return (
		<div
			id="user-row"
			className={`flex w-full flex-row items-start justify-between rounded-lg p-2 md:flex-row md:items-center ${borderColor({ acknowledged, volunteer })} ${background({ isCurrentSchedule, isCurrentUser, first })}`}
		>
			{showAdminButtons && (
				<div id="column-wrapper" className="mb-2 mr-2 flex h-full w-20 flex-col justify-center border-r-2">
					<CrossoverSortingButtons scheduleId={scheduleId} crossoverId={crossoverId} order={order} />
				</div>
			)}
			<div id="column-wrapper" className="flex w-full flex-col">
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
						{training && (
							<Badge
								id="requestsTraining"
								className={`mx-1 h-8 ${backgroundColor('default')} ${foregroundColor({ requestsTraining: training })} capitalize`}
								variant="outline"
							>
								<Icon
									name={trained ? 'diploma' : 'exclamation-triangle'}
									className={`h-6 w-6 pr-1 pt-1 ${foregroundColor({ trained })}`}
									aria-hidden="true"
								/>
								<div>Requests Training</div>
							</Badge>
						)}
						{showAdminButtons && <CrossoversAdminPanel users={users} crossoverId={crossoverId} userId={userId} />}
					</div>
				)}
				<div
					id="user-details"
					className="flex h-full w-full flex-col justify-between p-2 pb-0 md:flex-row md:items-center"
				>
					<div id="quickbooks-duty" className="flex w-full flex-col items-start justify-between">
						<div id="name-and-trained" className="flex flex-row">
							<strong
								id="quickbooks"
								className={`mb-1 overflow-hidden text-ellipsis text-nowrap underline ${acknowledged ? 'text-green-700 decoration-green-700' : acknowledged === false ? 'text-red-700 decoration-red-700' : ''}`}
							>
								{quickbooks}
							</strong>
							{userId && (
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
							)}
							{training && (
								<Badge
									id="trained"
									className={`mx-1 h-8 ${backgroundColor('default')} ${foregroundColor({ requestsTraining: training })} capitalize`}
									variant="outline"
								>
									<Icon
										name="diploma"
										className={`h-6 w-6 pr-1 pt-1 ${foregroundColor({ requestsTraining: training })}`}
										aria-hidden="true"
									/>
									<div>Requests Training</div>
								</Badge>
							)}
						</div>
						<div id="badges-and-duty" className="flex h-full w-full flex-row items-center gap-1">
							<Badge
								id="first-badge"
								className={`${first ? 'ml-[40px]' : 'ml-[10px]'} mr-1 h-6 capitalize ${backgroundColor(duty)} ${isCurrentSchedule && 'text-white'}`}
								variant="outline"
							>
								{duty}
							</Badge>
							<div id="column-wrapper" className="flex w-full flex-col">
								<div>{dutyDetail}</div>
								{showAdminButtons ? (
									<Input
										id="dutyNotes"
										className="w-full"
										defaultValue={dutyNotes ?? ''}
										onBlur={e => handleChange(e.currentTarget.value)}
									/>
								) : (
									<div>{dutyNotes}</div>
								)}
							</div>
						</div>
					</div>
					{currentUser && (
						<div id="buttons-row">
							<Form method="POST" {...form.props} className="flex flex-col gap-1 align-middle">
								<input type="hidden" name="crossoverId" value={crossoverId} />
								<input type="hidden" name="volunteerId" value={currentUser} />
								{isCurrentUser && !acknowledged && (
									<Button
										type="submit"
										name="intent"
										value="acknowledge"
										variant="outline"
										disabled={isLocked}
										className="w-36 border-2 border-green-700 text-primary shadow-sm shadow-gray-700"
									>
										Acknowledge
									</Button>
								)}
								{isCurrentUser && !training && (
									<Button
										type="submit"
										name="intent"
										value="requestsTraining"
										variant="outline"
										disabled={isLocked}
										className="w-36 border-2 border-[#f3ab23] text-primary shadow-sm shadow-gray-700"
									>
										Request Training
									</Button>
								)}
								{isCurrentUser && acknowledged !== false && (
									<Button
										type="submit"
										name="intent"
										value="assistance"
										variant="outline"
										disabled={isLocked}
										className="w-36 border-2 border-red-700 text-primary shadow-sm shadow-gray-700"
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
										disabled={isLocked}
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
										disabled={isLocked}
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
						{startString ? (
							<>
								<div id="distance-to-now" className="min-w-60 overflow-hidden text-ellipsis pr-2 text-body-sm">
									{distanceToNow}
								</div>
								<div id="duty-start" className="min-w-44 overflow-hidden text-ellipsis text-body-sm">
									{dutyStartString}
								</div>
								<div id="start" className="min-w-44 overflow-hidden text-ellipsis text-body-xs">
									&nbsp;{`[${startString}]`}
								</div>
							</>
						) : showAdminButtons ? (
							<input
								className="border-1 float-right mt-2 w-full rounded-sm border-black bg-secondary p-2 text-body-sm"
								aria-label="Date and time"
								type="datetime-local"
								step="300"
								value={dutyStartDate.toISOString().slice(0, 16)}
								onChange={handleChangeTimestamp}
							/>
						) : (
							<>
								<div id="distance-to-now" className="min-w-60 overflow-hidden text-ellipsis pr-2 text-body-sm">
									{distanceToNow}
								</div>
								<div id="duty-start" className="min-w-44 overflow-hidden text-ellipsis text-body-sm">
									{dutyStartString}
								</div>
							</>
						)}
					</div>
					{showAdminButtons && (
						<div id="column-wrapper" className="flex h-full w-20 flex-col justify-center border-l-2 pl-1">
							<CrossoverSortingButtons crossoverId={crossoverId} start={dutyStart} />
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

/**
 * CSS classes and styles
 *  - referenceKey
 *  - foregroundColor
 *  - borderColor
 *  - background
 */
const referenceKey = [
	{
		color: 'green-700',
		label: 'Acknowledged',
		description: 'Use these buttons to confirm that you will complete the duty.',
		className: 'mt-1',
	},
	{
		color: '[#f3ab23]',
		label: 'Request Training',
		description: 'Use these buttons if you would like to attempt the duty but need guidance or support.',
	},
	{
		color: 'red-700',
		label: 'Request Help',
		description:
			'Use these buttons if you do not wish to make the duty yourself and would like a volunteer to handle it.',
	},
	{
		color: 'blue-700',
		label: 'Volunteer to Help',
		description: 'Use these buttons to volunteer to handle the duty.',
		className: 'mb-0.5',
	},
	{
		color: 'yellow-700',
		label: 'No Response',
		description: `Default status for all users until they Acknowledge or Request Help.\nShould the designated member Acknowledge after a member has volunteered, the volunteer will be removed.`,
		className: 'mb-2',
	},
]
const foregroundColor = ({
	trained,
	requestsTraining,
	acknowledged,
}: {
	trained?: boolean | null
	requestsTraining?: boolean | null
	acknowledged?: boolean | null
}) => {
	if (trained) return 'text-blue-700 border-blue-700'
	if (requestsTraining) return 'text-[#f3ab23] border-[#f3ab23]'
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

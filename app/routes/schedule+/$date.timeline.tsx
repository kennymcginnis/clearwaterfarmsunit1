import { invariantResponse } from '@epic-web/invariant'
import {
	type ActionFunctionArgs,
	type UploadHandler,
	json,
	redirect,
	type LoaderFunctionArgs,
	unstable_composeUploadHandlers as composeUploadHandlers,
	unstable_createMemoryUploadHandler as createMemoryUploadHandler,
	unstable_parseMultipartFormData as parseMultipartFormData,
	type MetaFunction,
} from '@remix-run/node'
import { Form, Link, useLoaderData } from '@remix-run/react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList } from '#app/components/forms.tsx'
import { SearchBar } from '#app/components/search-bar'
import { Button } from '#app/components/ui/button'
import { Icon } from '#app/components/ui/icon'
import { csvFileToArray, csvUploadHandler } from '#app/utils/csv-helper.ts'
import { prisma } from '#app/utils/db.server.ts'
import { formatDates, formatHours } from '#app/utils/misc'
import { requireUserWithRole } from '#app/utils/permissions.ts'
import useScrollSync from '#app/utils/scroll-sync'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { useOptionalAdminUser, useOptionalUser } from '#app/utils/user.ts'

type TotalType = { [key: number]: number }
type PositionDitchType = {
	// position - for <tr>
	[key: number]: {
		// ditch - for <td>
		[key: number]: UserType
	}
}
type UserType = {
	id: string
	username: string
	ditch: number
	position: number
	hours: number | bigint | null
	start: Date | string | null
	stop: Date | string | null
	schedule: string[]
}

const UserSearchResultSchema = z.object({
	id: z.string(),
	username: z.string(),
	ditch: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(9)),
	position: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(36)),
	hours: z.preprocess(x => (x ? x : 0), z.coerce.number().multipleOf(0.01).min(0).max(36)),
	head: z.preprocess(x => (x ? x : 70), z.coerce.number().multipleOf(70).min(70).max(140)),
	start: z.date().nullable(),
	stop: z.date().nullable(),
})

const UserSearchResultsSchema = z.array(UserSearchResultSchema)

export async function action({ request, params }: ActionFunctionArgs) {
	const userId = await requireUserWithRole(request, 'admin')

	const uploadHandler: UploadHandler = composeUploadHandlers(csvUploadHandler, createMemoryUploadHandler())
	const formData = await parseMultipartFormData(request, uploadHandler)

	const csv = formData.get('selected_csv')?.toString()
	const schedules = csvFileToArray(csv)

	const result = UserSearchResultsSchema.safeParse(schedules)
	if (!result.success) {
		return json({ status: 'error', error: result.error.message } as const, {
			status: 400,
		})
	}

	const scheduleId = await prisma.schedule.findFirst({
		select: { id: true },
		where: { date: params.date },
	})
	invariantResponse(scheduleId, 'Not found', { status: 404 })

	for (let schedule of result.data) {
		await prisma.userSchedule.upsert({
			select: { scheduleId: true, ditch: true, userId: true },
			where: { userId_ditch_scheduleId: { userId: schedule.id, ditch: schedule.ditch, scheduleId: scheduleId.id } },
			create: {
				userId: schedule.id,
				ditch: schedule.ditch,
				scheduleId: scheduleId.id,
				hours: schedule.hours,
				head: schedule.head,
				start: schedule.start,
				stop: schedule.stop,
				createdBy: userId,
			},
			update: {
				hours: schedule.hours,
				head: schedule.head,
				start: schedule.start,
				stop: schedule.stop,
				updatedBy: userId,
			},
		})
	}

	return redirectWithToast('', {
		type: 'success',
		title: 'Success',
		description: 'Your schedule has been uploaded.',
	})
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	const searchTerm = new URL(request.url).searchParams.get('search')
	if (searchTerm === '') return redirect(`/schedule/${params.date}/timeline`)
	if (!params?.date) return redirect('/schedules')

	const like = `%${searchTerm ?? ''}%`
	const rawUsers = await prisma.$queryRaw`
		SELECT User.id, User.username, Port.ditch, Port.position, UserSchedule.hours, UserSchedule.head, UserSchedule.start, UserSchedule.stop
		FROM User
		INNER JOIN Port ON User.id = Port.userId
    LEFT JOIN (
      SELECT UserSchedule.userId, UserSchedule.ditch, UserSchedule.hours, UserSchedule.head, UserSchedule.start, UserSchedule.stop
      FROM Schedule 
      INNER JOIN UserSchedule ON Schedule.id = UserSchedule.scheduleId
      WHERE Schedule.date = ${params.date}
    ) UserSchedule
		ON User.id = UserSchedule.userId
		AND Port.ditch = UserSchedule.ditch
		WHERE User.username LIKE ${like}
		OR User.member LIKE ${like}
		ORDER BY Port.ditch, Port.position
	`

	const result = UserSearchResultsSchema.safeParse(rawUsers)
	if (!result.success) {
		return json(
			{
				status: 'error',
				error: result.error.message,
				users: null,
				totals: null,
				rows: null,
				cols: null,
				scheduleDate: null,
			} as const,
			{ status: 400 },
		)
	}

	const totals: TotalType = {}
	const users: PositionDitchType = {}
	for (let user of result.data) {
		const { start, stop } = user
		const userType = { ...user, schedule: formatDates({ start, stop }) }
		if (users[user.position]) users[user.position][user.ditch] = userType
		else users[user.position] = { [user.ditch]: userType }

		if (totals[user.ditch]) totals[user.ditch] += user.hours
		else totals[user.ditch] = user.hours
	}
	return json({ status: 'idle', users, totals, scheduleDate: params.date, error: null } as const)
}

export default function ScheduleTimelineRoute() {
	const currentUser = useOptionalUser()
	const userIsAdmin = useOptionalAdminUser()
	const { status, users, totals, scheduleDate, error } = useLoaderData<typeof loader>()

	const nodeRefA = useRef(null)
	const nodeRefB = useRef(null)

	const nodeRefs = useMemo(() => [nodeRefA, nodeRefB], [nodeRefA, nodeRefB])

	const { registerPane, unregisterPane } = useScrollSync({
		onSync: undefined,
		proportional: true,
		vertical: false,
		horizontal: true,
		enabled: true,
	})

	useEffect(() => {
		nodeRefs.forEach(nodeRef => {
			if (nodeRef?.current) {
				registerPane(nodeRef.current)
			}
		})
		return () =>
			nodeRefs.forEach(nodeRef => {
				if (nodeRef?.current) {
					unregisterPane(nodeRef.current)
				}
			})
	}, [nodeRefs, registerPane, unregisterPane])

	if (status === 'error') console.error(error)

	const [showAll, setShowAll] = useState(false)
	const toggleShowAll = () => setShowAll(!showAll)
	const [showUpload, setShowUpload] = useState(false)
	const toggleShowUpload = () => setShowUpload(!showUpload)

	if (!users || !Object.keys(users).length) return null
	return (
		<div className="text-align-webkit-center flex w-full flex-col items-center justify-center gap-1 bg-background">
			<div className="flex w-[90%] flex-row flex-wrap gap-2 p-0.5">
				<div className="my-1 flex flex-row space-x-2">
					<Button variant="outline" onClick={toggleShowAll} className="pb-2">
						Display {showAll ? 'Scheduled' : 'All'}
					</Button>
					{currentUser && scheduleDate ? (
						<Button asChild variant="secondary" className="ml-2 pb-2">
							<Link to={`/timeline/${scheduleDate}/${currentUser.username}`}>Jump to Self</Link>
						</Button>
					) : null}
				</div>
				<div className="my-1 flex-grow">
					<SearchBar action={`/schedule/${scheduleDate}/timeline`} status={status} autoFocus autoSubmit />
				</div>
				<div className="my-1 flex flex-row space-x-2">
					{userIsAdmin ? (
						<>
							<Button>
								<Link reloadDocument to={`/resources/download-timeline/${scheduleDate}`}>
									<Icon name="download">Download</Icon>
								</Link>
							</Button>
							<Button onClick={toggleShowUpload}>
								<Icon name="upload">Upload</Icon>
								{showUpload ? (
									<ChevronDown
										className="relative top-[1px] ml-1 h-4 w-4 transition duration-200 group-data-[state=open]:rotate-180"
										aria-hidden="true"
									/>
								) : (
									<ChevronUp
										className="relative top-[1px] ml-1 h-4 w-4 transition duration-200 group-data-[state=open]:rotate-180"
										aria-hidden="true"
									/>
								)}
							</Button>
						</>
					) : null}
				</div>
			</div>
			{showUpload ? (
				<div className="mt-2 flex w-[90%] flex-row justify-end space-x-2">
					<Form method="post" encType="multipart/form-data">
						<input aria-label="File" type="file" accept=".csv" name="selected_csv" />
						<Button type="submit" className="btn btn-sm">
							Upload CSV
						</Button>
					</Form>
				</div>
			) : null}
			<header className="sticky top-0 m-auto flex w-full flex-col items-center gap-6 bg-background text-foreground">
				<div className="m-auto block w-[90%] overflow-x-auto bg-background text-foreground" ref={nodeRefA}>
					<table>
						<thead>
							<tr>
								{Object.entries(totals).map(([ditch, hours]) => (
									<th className="sticky top-0 p-0.5" key={`ditch-${ditch}`}>
										{hours > 0 || showAll ? (
											<p className="mb-1 flex w-44 flex-col rounded-lg bg-primary-foreground px-5 py-3 text-center text-body-lg">
												Ditch {ditch}
												<p className="mb-2 w-full text-center text-body-md">{hours} hours</p>
											</p>
										) : null}
									</th>
								))}
							</tr>
						</thead>
					</table>
				</div>
			</header>

			<main className="m-auto w-[90%]" style={{ height: 'fill-available' }}>
				{status === 'idle' ? (
					users ? (
						<div className="m-auto block w-full overflow-x-auto overflow-y-auto" ref={nodeRefB}>
							<table>
								<tbody>
									{Object.keys(users).map(position => (
										<tr key={`${position}`}>
											{Object.keys(totals).map(ditch => {
												const user = users[Number(position)][Number(ditch)]
												return (
													<td className="p-0.5" key={`${ditch}${position}`}>
														{user && (user.hours || showAll) ? (
															<UserCard scheduleDate={scheduleDate} user={user} />
														) : null}
													</td>
												)
											})}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : (
						<p>No members found</p>
					)
				) : status === 'error' ? (
					<ErrorList errors={['There was an error parsing the results']} />
				) : null}
			</main>
		</div>
	)
}

function UserCard({ scheduleDate, user }: { scheduleDate: string; user: UserType }) {
	return (
		<Link
			to={`/timeline/${scheduleDate}/${user.username}`}
			className={`flex h-[82px] w-44 flex-col rounded-lg ${user.hours ? 'bg-muted' : 'bg-muted-40'} p-2`}
		>
			<div className="flex w-full flex-row justify-between gap-1 border-b-2">
				<span className="overflow-hidden text-ellipsis text-nowrap text-left text-body-sm text-muted-foreground">
					{user.position}: {user.username}
				</span>
				<span className="col-span-3 overflow-hidden text-ellipsis text-nowrap text-right text-body-sm text-muted-foreground">
					{formatHours(Number(user.hours))}
				</span>
			</div>
			{user.schedule.map((row, r) => (
				<span key={`row-${r}`} className="overflow-hidden text-ellipsis text-right text-body-sm text-muted-foreground">
					{row}
				</span>
			))}
		</Link>
	)
}

export const meta: MetaFunction<null, { 'routes/schedule+/$date/timeline': typeof loader }> = ({ params }) => {
	return [
		{ title: `Irrigation Timeline | ${params.date}` },
		{
			name: 'description',
			content: `Clearwater Farms 1 Irrigation Timeline`,
		},
	]
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}

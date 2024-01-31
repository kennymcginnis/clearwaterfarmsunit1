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
import { useState } from 'react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList } from '#app/components/forms.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { Button } from '#app/components/ui/button'
import { Icon } from '#app/components/ui/icon'
import { prisma } from '#app/utils/db.server.ts'
import { cn, useDelayedIsPending } from '#app/utils/misc.tsx'
import { requireUserWithRole } from '#app/utils/permissions.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { useOptionalUser } from '#app/utils/user.ts'

type TotalType = { [key: number]: number }
type DitchType = { [key: number]: PositionType }
type PositionType = { [key: number]: UserType }
type UserType = {
	id: string
	username: string
	ditch: number
	position: number
	hours: number | bigint
	head: number
}

const UserSearchResultSchema = z.object({
	id: z.string(),
	username: z.string(),
	ditch: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(9)),
	position: z.preprocess(x => (x ? x : undefined), z.coerce.number().int().min(1).max(36)),
	hours: z.preprocess(x => (x ? x : 0), z.coerce.number().multipleOf(0.01).min(0).max(36)),
	head: z.preprocess(x => (x ? x : 70), z.coerce.number().multipleOf(70).min(70).max(140)),
})

const UserSearchResultsSchema = z.array(UserSearchResultSchema)

const csvFileToArray = (string: string | undefined) => {
	if (!string) throw 'Empty CSV file'
	const csvHeader = string.slice(0, string.indexOf('\n')).split(',')
	const csvRows = string.slice(string.indexOf('\n') + 1).split('\n')

	const rows = csvRows.map((csvRow: string) => {
		const values = csvRow.split(',')
		const obj = csvHeader.reduce((agg: { [name: string]: string }, header: string, index: number) => {
			agg[header] = values[index]
			return agg
		}, {})
		return obj
	})
	return rows
}

export async function action({ request, params }: ActionFunctionArgs) {
	const userId = await requireUserWithRole(request, 'admin')

	const csvUploadHandler: UploadHandler = async ({ name, filename, data, contentType }) => {
		if (name !== 'selected_csv') {
			return undefined
		}
		let chunks = []
		for await (let chunk of data) {
			chunks.push(chunk)
		}

		return await new Blob(chunks, { type: contentType }).text()
	}

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
				createdBy: userId,
			},
			update: {
				hours: schedule.hours,
				head: schedule.head,
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

export async function loader({ params }: LoaderFunctionArgs) {
	if (!params?.date) {
		return redirect('/schedules')
	}

	const rawUsers = await prisma.$queryRaw`
		SELECT User.id, User.username, Port.ditch, Port.position, UserSchedule.hours, UserSchedule.head
		FROM User
		INNER JOIN Port ON User.id = Port.userId
    LEFT JOIN (
      SELECT UserSchedule.userId, UserSchedule.ditch, UserSchedule.hours, UserSchedule.head
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
		return json(
			{ status: 'error', error: result.error.message, ditches: null, totals: null, scheduleDate: null } as const,
			{
				status: 400,
			},
		)
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

	return json({ status: 'idle', ditches, totals, scheduleDate, error: null } as const)
}

export default function UsersRoute() {
	const data = useLoaderData<typeof loader>()
	const currentUser = useOptionalUser()

	const isPending = useDelayedIsPending({
		formMethod: 'GET',
		formAction: '/schedules',
	})

	if (data.status === 'error') {
		console.error(data.error)
	}

	const [showAll, setShowAll] = useState(false)
	const toggleShowAll = () => setShowAll(!showAll)
	const [showUpload, setShowUpload] = useState(false)
	const toggleShowUpload = () => setShowUpload(!showUpload)

	return (
		<>
			<div className="flex flex-row justify-between">
				<div className="flex flex-row space-x-2">
					<Button variant="outline" onClick={toggleShowAll}>
						Display {showAll ? 'Scheduled' : 'All'}
					</Button>
					{currentUser ? (
						<Button asChild variant="secondary">
							<Link to={`/schedule/${data.scheduleDate}/${currentUser.username}`}>Jump to Self</Link>
						</Button>
					) : null}
				</div>
				<div className="flex flex-row space-x-2">
					<Button>
						<Link reloadDocument to={`/resources/download-signup/${data.scheduleDate}`}>
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
				</div>
			</div>
			{showUpload ? (
				<div className="mt-2 flex flex-row justify-end space-x-2">
					<Form method="post" encType="multipart/form-data">
						<input aria-label="File" type="file" accept=".csv" name="selected_csv" />
						<Button type="submit" className="btn btn-sm">
							Upload CSV
						</Button>
					</Form>
				</div>
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
									<p className="mb-2 w-full text-center text-body-lg">Ditch {d}</p>
									<p className="mb-2 w-full text-center text-body-md">{data.totals[+d]} hours</p>
								</div>
							))}
						</div>
						<div className="grid max-h-[700px] w-full grid-cols-9 gap-4 overflow-auto delay-200">
							{Object.entries(data.ditches).map(([d, ditch]) => (
								<div key={`ditch-${d}`}>
									{Object.entries(ditch)
										.filter(([p, user]) => (user.hours || 0) > 0 || showAll)
										.map(([p, user]) => (
											<div key={`position-${p}`}>
												<Link
													to={`/schedule/${data.scheduleDate}/${user.username}`}
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
			) : data.status === 'error' ? (
				<ErrorList errors={['There was an error parsing the results']} />
			) : null}
		</>
	)
}

export const meta: MetaFunction<null, { 'routes/schedule+/$date/sign-up': typeof loader }> = ({ params }) => {
	return [
		{ title: `Irrigation Sign-Up | ${params.date}` },
		{
			name: 'description',
			content: `Clearwater Farms 1 Irrigation Schedule Sign-Up`,
		},
	]
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}

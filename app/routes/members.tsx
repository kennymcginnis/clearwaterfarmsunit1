import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList } from '#app/components/forms.tsx'
import { SearchBar } from '#app/components/search-bar.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { cn, getUserImgSrc, useDelayedIsPending } from '#app/utils/misc.tsx'

type DitchType = { [key: number]: PositionType }
type PositionType = { [key: number]: UserType }
type UserType = {
	id: string
	username: string
	imageId: string | null
	member: string | null
	ditch: number
	position: number
}

const UserSearchResultSchema = z.object({
	id: z.string(),
	username: z.string(),
	member: z.string().nullable(),
	imageId: z.string().nullable(),
	ditch: z.number(),
	position: z.number(),
})

const UserSearchResultsSchema = z.array(UserSearchResultSchema)

export async function loader({ request }: LoaderFunctionArgs) {
	const searchTerm = new URL(request.url).searchParams.get('search')
	if (searchTerm === '') {
		return redirect('/members')
	}

	const like = `%${searchTerm ?? ''}%`
	const rawUsers = await prisma.$queryRaw`
		SELECT User.id, User.username, User.member, UserImage.id AS imageId, Port.ditch, Port.position
		FROM User
		LEFT JOIN UserImage ON User.id = UserImage.userId
		INNER JOIN Port ON User.id = Port.userId
		WHERE User.username LIKE ${like}
		OR User.member LIKE ${like}
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
		ditches[user.ditch][user.position] = user
	}
	return json({ status: 'idle', users: ditches } as const)
}

export default function UsersRoute() {
	const data = useLoaderData<typeof loader>()
	const isPending = useDelayedIsPending({
		formMethod: 'GET',
		formAction: '/user',
	})

	if (data.status === 'error') {
		console.error(data.error)
	}

	return (
		<div className="mb-48 mt-36 flex flex-col items-center justify-center gap-6">
			<h1 className="text-h1">Clearwater Farms Unit 1 Members</h1>
			<div className="w-full max-w-[700px] ">
				<SearchBar status={data.status} autoFocus autoSubmit />
			</div>
			<main>
				{data.status === 'idle' ? (
					data.users ? (
						<>
							<div
								className={cn('grid w-full grid-cols-9 gap-4 delay-200', {
									'opacity-50': isPending,
								})}
							>
								{Object.keys(data.users).map(d => (
									<div key={`ditch-${d}`}>
										<p className="mb-2 w-full text-center text-body-lg">Ditch {d}</p>
									</div>
								))}
							</div>
							<div className="grid w-full grid-cols-9 gap-4 overflow-auto delay-200">
								{Object.entries(data.users).map(([d, ditch]) => (
									<div key={`ditch-${d}`}>
										{Object.entries(ditch).map(([p, user]) => (
											<div key={`position-${p}`}>
												<Link
													to={`/member/${user.username}`}
													className="mb-2 flex h-36 w-44 flex-col items-center justify-center rounded-lg bg-muted px-5 py-3"
												>
													<img
														alt={user.member ?? user.username}
														src={getUserImgSrc(user.imageId, user.id)}
														className="h-16 w-16 rounded-full"
													/>
													{user.member ? (
														<span className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-body-md">
															{user.member}
														</span>
													) : null}
													<span className="w-full overflow-hidden text-ellipsis text-center text-body-sm text-muted-foreground">
														Ditch: {d} Pos: {p}
													</span>
												</Link>
											</div>
										))}
									</div>
								))}
							</div>
						</>
					) : (
						<p>No users found</p>
					)
				) : data.status === 'error' ? (
					<ErrorList errors={['There was an error parsing the results']} />
				) : null}
			</main>
		</div>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}
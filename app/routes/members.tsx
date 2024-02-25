import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { useEffect, useMemo, useRef } from 'react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList } from '#app/components/forms.tsx'
import { SearchBar } from '#app/components/search-bar.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { getUserImgSrc } from '#app/utils/misc.tsx'
import useScrollSync from '#app/utils/scroll-sync'

type DitchType = { [key: number]: UserType[] }
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
		return json({ status: 'error', error: result.error.message, users: null, rows: null, cols: null } as const, {
			status: 400,
		})
	}

	let maxPos = 0,
		minDitch = 9,
		maxDitch = 1
	// initializing all ditches so they all appear in position after searches
	const ditches: DitchType = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [], 9: [] }
	for (let user of result.data) {
		ditches[user.ditch].push(user)
		if (ditches[user.ditch].length > maxPos) maxPos = ditches[user.ditch].length
		if (user.ditch < minDitch) minDitch = user.ditch
		if (user.ditch > maxDitch) maxDitch = user.ditch
	}

	let rows = Array.from({ length: maxPos }, (_, i) => i)
	let cols = Array.from({ length: maxDitch - minDitch + 1 }, (_, i) => i + minDitch)

	return json({ status: 'idle', error: null, users: ditches, rows, cols } as const)
}

export default function MembersRoute() {
	const { status, error, users, rows, cols } = useLoaderData<typeof loader>()

	if (status === 'error') console.error(error)

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

	return (
		<div className="text-align-webkit-center flex w-full flex-col items-center justify-center gap-1 bg-background">
			<header className="sticky top-0 m-auto flex w-full flex-col items-center gap-6 bg-background text-foreground">
				<div className="flex text-nowrap text-h2 max-md:hidden lg:text-h1">Clearwater Farms Unit 1 Members</div>
				<div className="flex text-nowrap text-h3 md:hidden">CWF Unit 1 Members</div>
				<div className="w-[70%]">
					<SearchBar action="/members" status={status} autoFocus autoSubmit />
				</div>
				<div className="m-auto block w-[90%] overflow-x-auto bg-background text-foreground" ref={nodeRefA}>
					<table>
						<thead>
							<tr>
								{(cols || []).map(c => (
									<th className="sticky top-0 p-1" key={`ditch-${c}`}>
										<p className="mb-1 flex w-44 rounded-lg bg-primary-foreground px-5 py-3 text-center text-body-lg">
											Ditch {c}
										</p>
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
									{rows.map(r => (
										<tr key={`${r}`}>
											{cols.map(c => (
												<td className="p-1" key={`${r}${c}`}>
													{users[c][r] ? <UserCard user={users[c][r] as UserType} /> : null}
												</td>
											))}
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

function UserCard({ user }: { user: UserType }) {
	return (
		<Link
			to={`/member/${user.username}/contact`}
			className="flex h-36 w-44 flex-col items-center justify-center rounded-lg bg-muted px-3"
		>
			<img
				alt={user.member ?? user.username}
				src={getUserImgSrc(user.imageId, user.id)}
				className="h-16 w-16 rounded-full"
			/>
			{user.member ? (
				<span className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-body-md">
					{user.username}
				</span>
			) : null}
			<span className="w-full overflow-hidden text-ellipsis text-center text-body-sm text-muted-foreground">
				Ditch: {user.ditch} Pos: {user.position}
			</span>
		</Link>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}

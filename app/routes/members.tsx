import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { useEffect, useMemo, useRef } from 'react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList } from '#app/components/forms.tsx'
import { SearchBar } from '#app/components/search-bar.tsx'
import { Button } from '#app/components/ui/button'
import { Icon } from '#app/components/ui/icon'
import { prisma } from '#app/utils/db.server'
import { formatCurrency, getUserImgSrc } from '#app/utils/misc.tsx'
import useScrollSync from '#app/utils/scroll-sync'
import { useOptionalAdminUser } from '#app/utils/user'

type TotalType = { [key: number]: boolean }
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
	display: string
	imageId: string | null
	member: string | null
	ditch: number
	position: number
	currentBalance: number | null
}

const UserSearchResultSchema = z.object({
	id: z.string(),
	username: z.string(),
	display: z.string(),
	member: z.string().nullable(),
	imageId: z.string().nullable(),
	ditch: z.number(),
	position: z.number(),
	currentBalance: z.number().nullable(),
})

const UserSearchResultsSchema = z.array(UserSearchResultSchema)

export async function loader({ request }: LoaderFunctionArgs) {
	const searchTerm = new URL(request.url).searchParams.get('search')
	if (searchTerm === '') {
		return redirect('/members')
	}

	const like = `%${searchTerm ?? ''}%`
	const rawUsers = await prisma.$queryRaw`
		SELECT User.id, User.username, User.display, User.member, UserImage.id AS imageId, 
			Port.ditch, Port.position,
			SUM(debit - credit) AS currentBalance
		FROM User
		LEFT JOIN UserImage ON User.id = UserImage.userId
		INNER JOIN Port ON User.id = Port.userId
		LEFT JOIN Transactions ON User.id = Transactions.userId
		WHERE User.active 
		AND (User.username LIKE ${like} OR User.member LIKE ${like})
		GROUP BY User.id, Port.ditch, Port.position
		ORDER BY Port.ditch, Port.position
	`

	const result = UserSearchResultsSchema.safeParse(rawUsers)
	if (!result.success) {
		return json({ status: 'error', error: result.error.message, users: null, totals: null } as const, {
			status: 400,
		})
	}

	const totals: TotalType = {}
	const users: PositionDitchType = {}
	for (let user of result.data) {
		const { position, ditch } = user
		if (users[position]) users[position][ditch] = user
		else users[position] = { [ditch]: user }

		totals[ditch] = true
	}
	return json({ status: 'idle', error: null, users, totals } as const)
}

export default function MembersRoute() {
	const { status, error, users, totals } = useLoaderData<typeof loader>()
	const userIsAdmin = useOptionalAdminUser()

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
				<div className="flex w-[63.5%] flex-row flex-wrap gap-2 space-x-2 p-0.5">
					<div className="my-1 min-w-[300px] flex-grow">
						<SearchBar action="/members" status={status} autoFocus autoSubmit />
					</div>
					<div className="my-1 flex flex-row space-x-2">
						{userIsAdmin ? (
							<Button>
								<Link reloadDocument to={`/transactions`}>
									<Icon name="reader" size="md">
										Transactions
									</Icon>
								</Link>
							</Button>
						) : null}
						<Button>
							<Link reloadDocument to={`/resources/download-balances`}>
								<Icon name="download" size="md">
									<span className="w-32">Download Balances</span>
								</Icon>
							</Link>
						</Button>
					</div>
				</div>
				<div className="m-auto block w-[90%] overflow-x-auto bg-background text-foreground" ref={nodeRefA}>
					<table>
						<thead>
							<tr>
								{Object.keys(totals || {}).map(ditch => (
									<th className="sticky top-0 p-0.5" key={`ditch-${ditch}`}>
										<p className="mb-1 flex w-44 rounded-lg bg-primary-foreground px-5 py-3 text-center text-body-lg">
											Ditch {ditch}
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
									{Object.keys(users).map(position => (
										<tr key={`${position}`}>
											{Object.keys(totals).map(ditch => {
												const user = users[Number(position)][Number(ditch)]
												return (
													<td className="p-0.5" key={`${ditch}${position}`}>
														{user ? (
															userIsAdmin ? (
																<Link
																	to={`/member/${user.username}/contact`}
																	className="flex h-36 w-44 flex-col items-center justify-center rounded-lg bg-muted px-3"
																>
																	<UserCard user={user} />
																</Link>
															) : (
																<div className="flex h-36 w-44 flex-col items-center justify-center rounded-lg bg-muted px-3">
																	<UserCard user={user} />
																</div>
															)
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

function UserCard({ user }: { user: UserType }) {
	return (
		<>
			<img
				alt={user.member ?? user.username}
				src={getUserImgSrc(user.imageId, user.id)}
				className="h-16 w-16 rounded-full"
			/>
			{user.member ? (
				<span className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-body-md">
					{user.display}
				</span>
			) : null}
			<span className="w-full overflow-hidden text-ellipsis text-center text-body-sm text-muted-foreground">
				Ditch: {user.ditch} Pos: {user.position}
			</span>
			<span className="w-full overflow-hidden text-ellipsis text-center text-body-sm text-muted-foreground">
				Balance: ${formatCurrency(user.currentBalance)}
			</span>
		</>
	)
}

export function ErrorBoundary() {
	return <GeneralErrorBoundary />
}

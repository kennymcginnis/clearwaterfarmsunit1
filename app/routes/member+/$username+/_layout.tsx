import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLocation, Form, useLoaderData, type MetaFunction, Outlet, Link } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { Tabs, TabsList, TabsTrigger } from '#app/components/ui/tabs'
import { prisma } from '#app/utils/db.server.ts'
import { getUserImgSrc } from '#app/utils/misc.tsx'
import { useOptionalUser } from '#app/utils/user.ts'

export async function loader({ params }: LoaderFunctionArgs) {
	const user = await prisma.user.findFirst({
		select: {
			id: true,
			member: true,
			username: true,
			image: {
				select: {
					id: true,
				},
			},
			createdAt: true,
		},
		where: {
			username: params.username,
		},
	})

	invariantResponse(user, 'User not found', { status: 404 })
	return json({ user, userJoinedDisplay: user.createdAt.toLocaleDateString() })
}

export default function ProfileRoute() {
	const { user, userJoinedDisplay } = useLoaderData<typeof loader>()

	const location = useLocation()
	const active = location.pathname.split('/').pop()
	console.log({ active })

	const userDisplayName = user.member ?? user.username
	const loggedInUser = useOptionalUser()
	const isLoggedInUser = user.id === loggedInUser?.id

	return (
		<div className="container mb-48 mt-36 flex flex-col items-center justify-center">
			<Spacer size="4xs" />

			<div className="container flex flex-col items-center rounded-3xl bg-muted p-3 md:p-12">
				<div className="relative h-52 w-52">
					<div className="absolute -top-40">
						<div className="relative">
							<img
								src={getUserImgSrc(user.image?.id, user.id)}
								alt={userDisplayName}
								className="h-52 w-52 rounded-full object-cover"
							/>
						</div>
					</div>
				</div>

				<div className="-mt-[140px] flex w-full flex-col items-center">
					<div className="flex flex-wrap items-center justify-center gap-4">
						<h1 className="text-center text-h2">{userDisplayName}</h1>
					</div>
					<p className="mt-2 text-center text-muted-foreground">Joined {userJoinedDisplay}</p>
					{isLoggedInUser ? (
						<Form action="/logout" method="POST" className="mt-3 flex gap-4">
							<Button type="submit" variant="default">
								<Icon name="exit" className="scale-125 max-md:scale-150">
									Logout
								</Icon>
							</Button>
						</Form>
					) : null}
					<div className="mt-6 flex w-full gap-4">
						<Tabs defaultValue="contact" className="w-full">
							<TabsList className="grid w-full grid-cols-4">
								<Link to="contact">
									<TabsTrigger
										value="contact"
										data-state={active === 'contact' ? 'active' : 'inactive'}
										className="w-full px-1"
									>
										Contact
									</TabsTrigger>
								</Link>
								<Link to="property">
									<TabsTrigger
										value="property"
										data-state={active === 'property' ? 'active' : 'inactive'}
										className="w-full px-1"
									>
										Property
									</TabsTrigger>
								</Link>
								<Link to="irrigation">
									<TabsTrigger
										value="irrigation"
										data-state={active === 'irrigation' ? 'active' : 'inactive'}
										className="w-full px-1"
									>
										Irrigation
									</TabsTrigger>
								</Link>
								<Link to="transactions">
									<TabsTrigger
										value="transactions"
										data-state={active === 'transactions' ? 'active' : 'inactive'}
										className="w-full px-1"
									>
										Transactions
									</TabsTrigger>
								</Link>
							</TabsList>
							<Outlet />
						</Tabs>
					</div>
				</div>
			</div>
		</div>
	)
}

export const meta: MetaFunction<typeof loader> = ({ data, params }) => {
	const displayName = data?.user.member ?? params.username
	return [
		{ title: `Profile | ${displayName}` },
		{
			name: 'description',
			content: `Profile of ${displayName} on Clearwater Farms 1`,
		},
	]
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => <p>No user with the username "{params.username}" exists</p>,
			}}
		/>
	)
}

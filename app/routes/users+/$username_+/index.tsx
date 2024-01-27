import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Form, Link, useLoaderData, type MetaFunction } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon.tsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#app/components/ui/tabs'
import { prisma } from '#app/utils/db.server.ts'
import { getUserImgSrc } from '#app/utils/misc.tsx'
import { useOptionalUser } from '#app/utils/user.ts'

export async function loader({ params }: LoaderFunctionArgs) {
	const user = await prisma.user.findFirst({
		select: {
			id: true,
			username: true,
			member: true,
			defaultHours: true,
			defaultHead: true,
			restricted: true,
			userAddress: {
				select: {
					address: { select: { address: true, parcelAndLot: { select: { parcel: true, lot: true } } } },
				},
			},
			primaryEmail: true,
			secondaryEmail: true,
			phones: {
				select: {
					type: true,
					number: true,
				},
			},
			ports: {
				select: {
					ditch: true,
					position: true,
				},
			},
			transactions: {
				select: {
					date: true,
					debit: true,
					credit: true,
					note: true,
				},
			},
			schedules: {
				select: {
					schedule: { select: { date: true, deadline: true, source: true, costPerHour: true } },
					hours: true,
					ditch: true,
				},
			},
			image: { select: { id: true } },
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
	const userDisplayName = user.member ?? user.username
	const loggedInUser = useOptionalUser()
	const isLoggedInUser = user.id === loggedInUser?.id

	const {
		username,
		member,
		primaryEmail,
		secondaryEmail,
		phones,
		defaultHours,
		defaultHead,
		restricted,
		schedules,
		ports,
	} = user

	return (
		<div className="container mb-48 mt-36 flex flex-col items-center justify-center">
			<Spacer size="4xs" />

			<div className="container flex flex-col items-center rounded-3xl bg-muted p-12">
				<div className="relative w-52">
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

				<Spacer size="sm" />

				<div className="flex flex-col items-center">
					<div className="flex flex-wrap items-center justify-center gap-4">
						<h1 className="text-center text-h2">{userDisplayName}</h1>
					</div>
					<p className="mt-2 text-center text-muted-foreground">Joined {userJoinedDisplay}</p>
					{isLoggedInUser ? (
						<Form action="/logout" method="POST" className="mt-3">
							<Button type="submit" variant="link" size="pill">
								<Icon name="exit" className="scale-125 max-md:scale-150">
									Logout
								</Icon>
							</Button>
						</Form>
					) : null}
					<div className="mt-10 flex gap-4">
						{isLoggedInUser ? (
							<Tabs defaultValue="contact" className="w-[800px]">
								<TabsList className="grid w-[400px] grid-cols-4">
									<TabsTrigger value="contact" defaultChecked>
										Contact
									</TabsTrigger>
									<TabsTrigger value="property">Property</TabsTrigger>
									<TabsTrigger value="deposits">Deposits</TabsTrigger>
									<TabsTrigger value="irrigation">Irrigation</TabsTrigger>
								</TabsList>
								<TabsContent value="contact">
									<Card>
										<CardHeader>
											<CardTitle>Contact Information</CardTitle>
										</CardHeader>
										<CardContent className="space-y-2">
											<Button asChild variant="default">
												<Link className="button" to="/settings/profile" prefetch="intent">
													Edit profile
												</Link>
											</Button>
											<div className="space-y-1">
												<pre>{JSON.stringify({ username, member, primaryEmail, secondaryEmail, phones }, null, 2)}</pre>
											</div>
										</CardContent>
									</Card>
								</TabsContent>
								<TabsContent value="property">
									<Card>
										<CardHeader>
											<CardTitle>Property</CardTitle>
										</CardHeader>
										<CardContent className="space-y-2">
											<div className="space-y-1">
												<pre>{JSON.stringify([...user.userAddress], null, 2)}</pre>
											</div>
										</CardContent>
									</Card>
								</TabsContent>
								<TabsContent value="deposits">
									<Card>
										<CardHeader>
											<CardTitle>Deposits</CardTitle>
											<CardDescription>Irrigation Account Balance</CardDescription>
										</CardHeader>
										<CardContent className="space-y-2">
											<div className="space-y-1">
												<pre>{JSON.stringify([...user.transactions], null, 2)}</pre>
											</div>
										</CardContent>
									</Card>
								</TabsContent>
								<TabsContent value="irrigation">
									<Card>
										<CardHeader>
											<CardTitle>Irrigation</CardTitle>
											<CardDescription>Irrigation Schedules</CardDescription>
										</CardHeader>
										<CardContent className="space-y-2">
											<div className="space-y-1">
												<pre>
													{JSON.stringify({ defaultHours, defaultHead, restricted, ports, schedules }, null, 2)}
												</pre>
											</div>
										</CardContent>
									</Card>
								</TabsContent>
							</Tabs>
						) : (
							<Button asChild>
								<Link to="notes" prefetch="intent">
									{userDisplayName}'s notes
								</Link>
							</Button>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

export const meta: MetaFunction<typeof loader> = ({ data, params }) => {
	const displayName = data?.user.member ?? params.username
	return [
		{ title: `${displayName} | Clearwater Farms 1` },
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

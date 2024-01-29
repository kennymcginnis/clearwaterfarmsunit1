import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Form, Link, useLoaderData, type MetaFunction } from '@remix-run/react'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { DisplayField } from '#app/components/forms.tsx'
import { Spacer } from '#app/components/spacer.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon.tsx'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { Separator } from '#app/components/ui/separator'
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
					id: true,
					address: { select: { id: true, address: true, parcelAndLot: { select: { parcel: true, lot: true } } } },
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
					entry: true,
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

	const currentBalance = await prisma.transaction.groupBy({
		by: ['userId'],
		_sum: { debit: true, credit: true },
		where: { userId: user.id },
	})

	return json({ user, currentBalance, userJoinedDisplay: user.createdAt.toLocaleDateString() })
}

export default function ProfileRoute() {
	const { user, currentBalance, userJoinedDisplay } = useLoaderData<typeof loader>()
	const userDisplayName = user.member ?? user.username
	const loggedInUser = useOptionalUser()
	const isLoggedInUser = user.id === loggedInUser?.id

	const debit = currentBalance[0]?._sum?.debit ?? 0
	const credit = currentBalance[0]?._sum?.credit ?? 0

	if (user.transactions.length === 0) {
		user.transactions.push({
			credit: 0,
			debit: 0,
			date: '2024-01-01',
			note: '2024 Starting Balance',
		})
	}

	const {
		username,
		member,
		primaryEmail,
		secondaryEmail,
		phones,
		defaultHours,
		defaultHead,
		restricted,
		ports,
		transactions,
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
						<Form action="/logout" method="POST" className="mt-3 flex gap-4">
							<Button asChild variant="default">
								<Link className="button" to="/settings/profile" prefetch="intent">
									<Icon name="pencil-1" className="scale-125 max-md:scale-150">
										Edit profile
									</Icon>
								</Link>
							</Button>
							<Button type="submit" variant="default">
								<Icon name="exit" className="scale-125 max-md:scale-150">
									Logout
								</Icon>
							</Button>
						</Form>
					) : null}
					<div className="mt-10 flex gap-4">
						<Tabs defaultValue="contact" className="w-[800px]">
							<TabsList className="grid w-[400px] grid-cols-4">
								<TabsTrigger value="contact" defaultChecked>
									Contact
								</TabsTrigger>
								<TabsTrigger value="property">Property</TabsTrigger>
								<TabsTrigger value="irrigation">Irrigation</TabsTrigger>
								<TabsTrigger value="transactions" className="w-[120px] ">
									Transactions
								</TabsTrigger>
							</TabsList>
							<TabsContent value="contact">
								<Card>
									<CardHeader>
										<CardTitle>Contact Information</CardTitle>
									</CardHeader>
									<CardContent className="space-y-2">
										<div className="grid grid-cols-6 gap-x-10 gap-y-3">
											<DisplayField
												className="col-span-3"
												labelProps={{ htmlFor: username, children: 'Username' }}
												inputProps={{ defaultValue: username }}
											/>
											<DisplayField
												className="col-span-6"
												labelProps={{ htmlFor: member ?? '', children: 'Member Name' }}
												inputProps={{ defaultValue: member ?? '' }}
											/>
											<DisplayField
												className="col-span-6"
												labelProps={{ htmlFor: primaryEmail ?? '', children: 'Primary Email' }}
												inputProps={{ defaultValue: primaryEmail ?? '' }}
											/>
											<DisplayField
												className="col-span-6"
												labelProps={{ htmlFor: secondaryEmail ?? '', children: 'Secondary Email' }}
												inputProps={{ defaultValue: secondaryEmail ?? '' }}
											/>
											{phones.map(phone => (
												<DisplayField
													key={phone.type}
													className="col-span-4 capitalize"
													labelProps={{ htmlFor: phone.type, children: `${phone.type} Number` }}
													inputProps={{ defaultValue: phone.number }}
												/>
											))}
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
										{user.userAddress.map((userAddress, i) => (
											<div key={userAddress.id} className="grid grid-cols-6 gap-x-10 gap-y-3">
												{i > 0 ? <Separator className="col-span-6 mb-1 mt-3 border-b-2 border-t-2" /> : null}
												<DisplayField
													className="col-span-6"
													labelProps={{ htmlFor: userAddress.address.address ?? '', children: 'Address' }}
													inputProps={{ defaultValue: userAddress.address.address }}
												/>
												{userAddress.address.parcelAndLot.map(parcelAndLot => (
													<>
														<DisplayField
															className="col-span-3"
															labelProps={{ htmlFor: parcelAndLot.parcel, children: 'Parcel' }}
															inputProps={{ defaultValue: parcelAndLot.parcel }}
														/>
														<DisplayField
															className="col-span-3"
															labelProps={{ htmlFor: parcelAndLot.lot, children: 'Lot' }}
															inputProps={{ defaultValue: parcelAndLot.lot }}
														/>
													</>
												))}
											</div>
										))}
									</CardContent>
								</Card>
							</TabsContent>
							<TabsContent value="transactions">
								<Card>
									<CardHeader>
										<CardTitle>Transactions</CardTitle>
										<CardDescription>Irrigation Account Balance</CardDescription>
									</CardHeader>
									<CardContent className="space-y-2">
										<div className="grid grid-cols-6 gap-x-1 gap-y-3">
											<>
												<Label htmlFor="Date" children="Date" className="col-span-1 pr-3 text-right" />
												<Label htmlFor="Date" children="Debit" className="col-span-1 pr-3 text-right" />
												<Label htmlFor="Date" children="Credit" className="col-span-1 pr-3 text-right" />
												<Label htmlFor="Date" children="Note" className="col-span-3 pl-3" />
											</>
											{transactions.map((lineItem, i) => (
												<>
													<Input
														id="date"
														readOnly={true}
														className="col-span-1 text-right"
														defaultValue={lineItem.date}
													/>
													<Input
														id="debit"
														readOnly={true}
														className="col-span-1 text-right"
														defaultValue={lineItem.debit?.toString() ?? ''}
													/>
													<Input
														id="credit"
														readOnly={true}
														className="col-span-1 text-right"
														defaultValue={lineItem.credit?.toString() ?? ''}
													/>
													<Input id="note" readOnly={true} className="col-span-3" defaultValue={lineItem.note ?? ''} />
												</>
											))}

											<Separator className="col-span-6 mb-1 mt-1 border-b-2 border-t-2" />

											<Input
												id="date"
												readOnly={true}
												className="col-span-1 text-right"
												defaultValue={new Date().toISOString().substring(0, 10)}
											/>
											<Input
												id="total"
												readOnly={true}
												className="col-span-2 text-right"
												defaultValue={(debit || 0) - (credit || 0)}
											/>
											<Input id="balance" readOnly={true} className="col-span-3" defaultValue="Current Balance" />
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
										<div className="grid grid-cols-6 gap-x-10 gap-y-3">
											{restricted ? (
												<DisplayField
													className="col-span-6 text-foreground-destructive"
													labelProps={{ htmlFor: restricted.toString() }}
													inputProps={{
														className: 'text-center uppercase border-destructive',
														defaultValue: 'User Account Restricted',
													}}
												/>
											) : null}
											<DisplayField
												className="col-span-3"
												labelProps={{ htmlFor: (defaultHours || 0).toString(), children: 'Default Hours' }}
												inputProps={{ defaultValue: defaultHours }}
											/>
											<DisplayField
												className="col-span-3"
												labelProps={{ htmlFor: (defaultHead || 70).toString(), children: 'Default Head' }}
												inputProps={{ defaultValue: defaultHead }}
											/>
											<Separator className="col-span-6 mb-1 mt-1" />
											{ports.map(port => (
												<>
													<DisplayField
														className="col-span-2"
														labelProps={{ htmlFor: port.ditch.toString(), children: 'Ditch' }}
														inputProps={{ defaultValue: port.ditch }}
													/>
													<DisplayField
														className="col-span-2"
														labelProps={{ htmlFor: port.position.toString(), children: 'Position' }}
														inputProps={{ defaultValue: port.position }}
													/>
													{port.entry ? (
														<DisplayField
															className="col-span-2"
															labelProps={{ htmlFor: port.entry, children: 'Entry' }}
															inputProps={{ defaultValue: port.entry }}
														/>
													) : (
														<div></div>
													)}
												</>
											))}
										</div>
									</CardContent>
								</Card>
							</TabsContent>
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

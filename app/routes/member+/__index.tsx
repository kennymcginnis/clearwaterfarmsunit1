import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Form, Link, useLoaderData, type MetaFunction } from '@remix-run/react'
import { useState } from 'react'
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

export default function MemberRoute() {
	const { user, currentBalance, userJoinedDisplay } = useLoaderData<typeof loader>()
	const { transactions } = user

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

	const [editProfile, setEditProfile] = useState('')
	const toggleEditProfile = (profile: string) => {
		if (editProfile === profile) setEditProfile('')
		else setEditProfile(profile)
	}

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
								<TabsTrigger value="contact" defaultChecked>
									Contact
								</TabsTrigger>
								<TabsTrigger value="property">Property</TabsTrigger>
								<TabsTrigger value="irrigation">Irrigation</TabsTrigger>
								<TabsTrigger value="transactions">Transactions</TabsTrigger>
							</TabsList>
							<TabsContent value="contact">
								<Card>
									<CardHeader>
										<CardTitle>Contact Information</CardTitle>
										<Button variant="outline" className="pb-2">
											<Link className="button" to="/settings/profile" prefetch="intent">
												<Icon name="pencil-1" className="scale-125 max-md:scale-150">
													Edit Contact
												</Icon>
											</Link>
										</Button>
									</CardHeader>
									{ViewProfile(user)}
								</Card>
							</TabsContent>
							<TabsContent value="property">
								<Card>
									<CardHeader>
										<CardTitle>Property</CardTitle>
										<Button variant="outline" onClick={() => toggleEditProfile('property')} className="pb-2">
											<Icon name="pencil-1" className="scale-125 max-md:scale-150">
												Edit Property
											</Icon>
										</Button>
									</CardHeader>
									{ViewProperty(user)}
								</Card>
							</TabsContent>
							<TabsContent value="transactions">
								<Card>
									<CardHeader>
										<CardTitle>Transactions</CardTitle>
										<Button variant="outline" onClick={() => toggleEditProfile('transactions')} className="pb-2">
											<Icon name="pencil-1" className="scale-125 max-md:scale-150">
												Edit Transactions
											</Icon>
										</Button>
									</CardHeader>
									{ViewTransactions(transactions, debit, credit)}
								</Card>
							</TabsContent>
							<TabsContent value="irrigation">
								<Card>
									<CardHeader>
										<CardTitle>Irrigation</CardTitle>
										<Button variant="outline" onClick={() => toggleEditProfile('irrigation')} className="pb-2">
											<Icon name="pencil-1" className="scale-125 max-md:scale-150">
												Edit Irrigation
											</Icon>
										</Button>
									</CardHeader>
									{editProfile === 'irrigation' ? null : ViewIrrigation(user)}
								</Card>
							</TabsContent>
						</Tabs>
					</div>
				</div>
			</div>
		</div>
	)
}

function ViewIrrigation(user: {
	restricted: boolean
	defaultHours: number
	defaultHead: number
	ports: {
		ditch: number
		position: number
		entry: string | null
	}[]
}) {
	return (
		<CardContent className="space-y-2">
			<CardDescription>Irrigation Schedules</CardDescription>
			<div className="grid grid-cols-6 gap-x-10 gap-y-3">
				{user.restricted ? (
					<DisplayField
						className="col-span-6 text-foreground-destructive"
						labelProps={{ htmlFor: user.restricted.toString() }}
						inputProps={{
							className: 'text-center uppercase border-destructive',
							defaultValue: 'User Account Restricted',
						}}
					/>
				) : null}
				<DisplayField
					className="col-span-3"
					labelProps={{ htmlFor: (user.defaultHours || 0).toString(), children: 'Default Hours' }}
					inputProps={{ defaultValue: user.defaultHours }}
				/>
				<DisplayField
					className="col-span-3"
					labelProps={{ htmlFor: (user.defaultHead || 70).toString(), children: 'Default Head' }}
					inputProps={{ defaultValue: user.defaultHead }}
				/>
				<Separator className="col-span-6 mb-1 mt-1" />
				{user.ports.map(port => (
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
	)
}

function ViewTransactions(
	transactions: {
		date: string
		debit: number | null
		credit: number | null
		note: string | null
	}[],
	debit: number,
	credit: number,
) {
	return (
		<CardContent className="space-y-2">
			<CardDescription>Irrigation Account Balance</CardDescription>
			<div className="grid grid-cols-6 gap-1">
				<>
					<Label htmlFor="Date" children="Date" className="col-span-1 pr-3 text-right" />
					<Label htmlFor="Date" children="Debit" className="col-span-1 pr-3 text-right" />
					<Label htmlFor="Date" children="Credit" className="col-span-1 pr-3 text-right" />
					<Label htmlFor="Date" children="Note" className="col-span-3 pl-3" />
				</>
				{transactions.map((lineItem, i) => (
					<>
						<Input id="date" readOnly={true} className="col-span-1 text-right" defaultValue={lineItem.date} />
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
	)
}

function ViewProperty(user: {
	userAddress: {
		id: string
		address: {
			address: string
			parcelAndLot: {
				parcel: string
				lot: string
			}[]
		}
	}[]
}) {
	return (
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
	)
}

function ViewProfile(user: {
	username: string
	member: string | null
	primaryEmail: string | null
	secondaryEmail: string | null
	phones: ({
		number: string
		type: string
	} & {})[]
}) {
	return (
		<CardContent className="space-y-2">
			<div className="grid grid-cols-6 gap-x-10 gap-y-3">
				<DisplayField
					className="col-span-3"
					labelProps={{ htmlFor: user.username, children: 'Username' }}
					inputProps={{ defaultValue: user.username }}
				/>
				<DisplayField
					className="col-span-6"
					labelProps={{ htmlFor: user.member ?? '', children: 'Member Name' }}
					inputProps={{ defaultValue: user.member ?? '' }}
				/>
				<DisplayField
					className="col-span-6"
					labelProps={{ htmlFor: user.primaryEmail ?? '', children: 'Primary Email' }}
					inputProps={{ defaultValue: user.primaryEmail ?? '' }}
				/>
				<DisplayField
					className="col-span-6"
					labelProps={{ htmlFor: user.secondaryEmail ?? '', children: 'Secondary Email' }}
					inputProps={{ defaultValue: user.secondaryEmail ?? '' }}
				/>
				{user.phones.map(phone => (
					<DisplayField
						key={phone.type}
						className="col-span-4 capitalize"
						labelProps={{ htmlFor: phone.type, children: `${phone.type} Number` }}
						inputProps={{ defaultValue: phone.number }}
					/>
				))}
			</div>
		</CardContent>
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

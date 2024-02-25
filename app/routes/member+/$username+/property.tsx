import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, type MetaFunction } from '@remix-run/react'
import { useState } from 'react'
import { DisplayField } from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Card, CardContent, CardHeader, CardTitle } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon.tsx'
import { Separator } from '#app/components/ui/separator'
import { prisma } from '#app/utils/db.server.ts'
import { useOptionalUser, useOptionalAdminUser } from '#app/utils/user'

export async function loader({ params }: LoaderFunctionArgs) {
	const user = await prisma.user.findFirst({
		select: {
			id: true,
			member: true,
			username: true,
			restricted: true,
			ports: {
				select: {
					ditch: true,
					position: true,
					entry: true,
				},
			},
			userAddress: {
				select: {
					id: true,
					address: {
						select: {
							id: true,
							address: true,
							parcelAndLot: {
								select: {
									parcel: true,
									lot: true,
								},
							},
						},
					},
				},
			},
		},
		where: {
			username: params.username,
		},
	})

	invariantResponse(user, 'User not found', { status: 404 })
	return json({ user })
}

export default function PropertyRoute() {
	const { user } = useLoaderData<typeof loader>()
	const currentUser = useOptionalUser()
	const userIsAdmin = useOptionalAdminUser()
	const canEdit = currentUser?.id === user.id || userIsAdmin

	const [editProfile, setEditProfile] = useState('')
	const toggleEditProfile = (profile: string) => {
		if (editProfile === profile) setEditProfile('')
		else setEditProfile(profile)
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Property</CardTitle>
				{canEdit && (
					<Button variant="outline" onClick={() => toggleEditProfile('property')} className="pb-2">
						<Icon name="pencil-1" className="scale-125 max-md:scale-150">
							Edit Property
						</Icon>
					</Button>
				)}
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
								) : null}
							</>
						))}
					</div>
				))}
			</CardContent>
		</Card>
	)
}

export const meta: MetaFunction<typeof loader> = ({ data, params }) => {
	const displayName = data?.user.member ?? params.username
	return [
		{ title: `Property | ${displayName}` },
		{
			name: 'description',
			content: `Property of ${displayName} at Clearwater Farms 1`,
		},
	]
}

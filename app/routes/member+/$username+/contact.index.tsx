import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData, type MetaFunction } from '@remix-run/react'
import { DisplayField } from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Card, CardContent, CardHeader, CardTitle } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon.tsx'
import { requireSelfOrAdmin } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server.ts'
import { useOptionalUser, useOptionalAdminUser } from '#app/utils/user'

export async function loader({ request, params }: LoaderFunctionArgs) {
	await requireSelfOrAdmin({ request, params }, { redirectTo: '/members' })
	const user = await prisma.user.findFirst({
		select: {
			id: true,
			member: true,
			username: true,
			primaryEmail: true,
			secondaryEmail: true,
			phones: {
				select: {
					type: true,
					number: true,
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

export default function ContactRoute() {
	const { user } = useLoaderData<typeof loader>()
	const currentUser = useOptionalUser()
	const userIsAdmin = useOptionalAdminUser()
	const viewingSelf = currentUser?.id === user.id

	return (
		<Card>
			<CardHeader>
				<CardTitle>Contact Information</CardTitle>
				{viewingSelf ? (
					<Button variant="outline" className="pb-2">
						<Link className="button" to="/settings/profile" prefetch="intent">
							<Icon name="pencil-1" className="scale-125 max-md:scale-150">
								Edit Profile
							</Icon>
						</Link>
					</Button>
				) : userIsAdmin ? (
					<Button variant="outline" className="pb-2">
						<Link className="button" to="edit" prefetch="intent">
							<Icon name="pencil-1" className="scale-125 max-md:scale-150">
								Edit Contact
							</Icon>
						</Link>
					</Button>
				) : null}
			</CardHeader>
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
		</Card>
	)
}

export const meta: MetaFunction<typeof loader> = ({ data, params }) => {
	const displayName = data?.user.member ?? params.username
	return [
		{ title: `Contact | ${displayName}` },
		{
			name: 'description',
			content: `Contact Details for ${displayName} Clearwater Farms 1`,
		},
	]
}

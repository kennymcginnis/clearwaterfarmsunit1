import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { type MetaFunction, useFetcher, Link, useLoaderData } from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { Field, ErrorList } from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Icon } from '#app/components/ui/icon'
import { StatusButton } from '#app/components/ui/status-button'
import { CreatePhone, UpdatePhone } from '#app/routes/member+/$username+/_edit'
import { requireUserId } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { useDoubleCheck, getUserImgSrc } from '#app/utils/misc'
import { ProfileFormSchema } from '#app/utils/user-validation.ts'

export { action } from '#app/routes/member+/$username+/_edit.server'

const profileUpdateActionIntent = 'update-profile'
const signOutOfSessionsActionIntent = 'sign-out-of-sessions'

export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const user = await prisma.user.findUniqueOrThrow({
		where: { id: userId },
		select: {
			id: true,
			member: true,
			username: true,
			primaryEmail: true,
			secondaryEmail: true,
			phones: {
				select: {
					id: true,
					type: true,
					number: true,
					primary: true,
				},
				orderBy: {
					primary: 'desc',
				},
			},
			image: { select: { id: true } },
			_count: {
				select: {
					sessions: {
						where: {
							expirationDate: { gt: new Date() },
						},
					},
				},
			},
		},
	})

	return json({ user })
}

export default function EditUserProfile() {
	const data = useLoaderData<typeof loader>()

	return (
		<div className="flex flex-col gap-10">
			<div className="flex justify-center">
				<div className="relative h-52 w-52">
					<img
						src={getUserImgSrc(data.user.image?.id, data.user.id)}
						alt={data.user.username}
						className="h-full w-full rounded-full object-cover"
					/>
					<Button
						asChild
						variant="outline"
						className="absolute -right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full p-0"
					>
						<Link preventScrollReset to="photo" title="Change profile photo" aria-label="Change profile photo">
							<Icon name="camera" className="h-4 w-4" />
						</Link>
					</Button>
				</div>
			</div>
			<UpdateProfile />

			<div className="col-span-6 my-4 h-1 border-b-[1.5px] border-foreground" />
			<div className="col-span-full flex flex-col gap-6">
				<Link reloadDocument download="my-epic-notes-data.json" to="/resources/download/user-data">
					<Icon name="download">Download your data</Icon>
				</Link>
				<SignOutOfSessions />
				{/* <DeleteData /> */}
			</div>
		</div>
	)
}

function UpdateProfile() {
	const data = useLoaderData<typeof loader>()
	const fetcher = useFetcher()

	const [form, fields] = useForm({
		id: 'edit-profile',
		constraint: getFieldsetConstraint(ProfileFormSchema),
		onValidate({ formData }) {
			return parse(formData, { schema: ProfileFormSchema })
		},
		defaultValue: {
			username: data.user.username,
			member: data.user.member ?? '',
			primaryEmail: data.user.primaryEmail,
			secondaryEmail: data.user.secondaryEmail,
		},
	})

	return (
		<fetcher.Form method="POST" {...form.props}>
			<AuthenticityTokenInput />
			<div className="grid grid-cols-6 gap-2">
				<Field
					className="col-span-2"
					labelProps={{ htmlFor: fields.username.id, children: 'Username' }}
					inputProps={conform.input(fields.username)}
					errors={fields.username.errors}
				/>
				<div className="col-span-4 content-end">
					<Button variant="outline" className="border-secondary bg-muted pb-2">
						<Link to={'password'}>
							<Icon name="dots-horizontal">Change Password</Icon>
						</Link>
					</Button>
				</div>
				<Field
					className="col-span-6"
					labelProps={{ htmlFor: fields.member.id, children: 'Member Name' }}
					inputProps={conform.input(fields.member)}
					errors={fields.member.errors}
				/>
				<div className="col-span-3 pb-4">
					<label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
						Primary Email
					</label>
					<Link
						className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid]:border-input-invalid"
						to="change-email"
						aria-label="Change email"
					>
						<Icon name="envelope-closed">
							{data.user.primaryEmail ? `Change email from ${data.user.primaryEmail}` : 'Add primary email'}
						</Icon>
					</Link>
				</div>

				<Field
					className="col-span-3"
					labelProps={{ htmlFor: fields.secondaryEmail.id, children: 'Secondary Email' }}
					inputProps={conform.input(fields.secondaryEmail)}
					errors={fields.secondaryEmail.errors}
				/>
			</div>

			<ErrorList errors={form.errors} id={form.errorId} />
			<div className="mt-4 flex justify-center">
				<StatusButton
					type="submit"
					size="wide"
					name="intent"
					value={profileUpdateActionIntent}
					status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
				>
					Save Changes
				</StatusButton>
			</div>
			<div className="col-span-6 my-4 h-1 border-b-[1.5px] border-foreground" />

			{data.user.phones.map(phone => (
				<UpdatePhone key={phone.id} userId={data.user.id} phone={phone} />
			))}
			<CreatePhone userId={data.user.id} />
		</fetcher.Form>
	)
}

function SignOutOfSessions() {
	const data = useLoaderData<typeof loader>()
	const dc = useDoubleCheck()

	const fetcher = useFetcher()
	const otherSessionsCount = data.user._count.sessions - 1
	return otherSessionsCount ? (
		<fetcher.Form method="POST">
			<AuthenticityTokenInput />
			<StatusButton
				{...dc.getButtonProps({
					type: 'submit',
					name: 'intent',
					value: signOutOfSessionsActionIntent,
				})}
				variant={dc.doubleCheck ? 'destructive' : 'default'}
				status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
			>
				<Icon name="avatar">
					{dc.doubleCheck ? `Are you sure?` : `Sign out of ${otherSessionsCount} other sessions`}
				</Icon>
			</StatusButton>
		</fetcher.Form>
	) : (
		<Icon name="avatar">This is your only session</Icon>
	)
}

export const meta: MetaFunction<typeof loader> = ({ data, params }) => {
	const displayName = data?.user.member ?? params.username
	return [
		{ title: `Profile | ${displayName}` },
		{
			name: 'description',
			content: `Profile Details for ${displayName} Clearwater Farms 1`,
		},
	]
}

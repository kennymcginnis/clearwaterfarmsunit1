import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, type MetaFunction, Form } from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { Field } from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '#app/components/ui/card'
import { StatusButton } from '#app/components/ui/status-button'
import { UpdatePhone, CreatePhone } from '#app/routes/member+/$username+/_edit'
import { prisma } from '#app/utils/db.server.ts'
import { useIsPending } from '#app/utils/misc'
import { UserContactSchema } from '#app/utils/user-validation.ts'

export { action } from '#app/routes/member+/$username+/_edit.server'

export async function loader({ params }: LoaderFunctionArgs) {
	const user = await prisma.user.findFirst({
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
		},
		where: {
			username: params.username,
		},
	})

	invariantResponse(user, 'User not found', { status: 404 })
	return json({ user })
}

export default function ContactEditRoute() {
	const { user } = useLoaderData<typeof loader>()
	const isPending = useIsPending()

	const [form, fields] = useForm({
		id: `user-form-contact`,
		constraint: getFieldsetConstraint(UserContactSchema),
		// lastSubmission: actionData?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: UserContactSchema })
		},
		defaultValue: {
			username: user.username ?? '',
			member: user.member ?? '',
			primaryEmail: user.primaryEmail ?? '',
			secondaryEmail: user.secondaryEmail ?? '',
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<Card>
			<Form method="POST" {...form.props}>
				<CardHeader>
					<CardTitle>Contact Information</CardTitle>
				</CardHeader>
				<AuthenticityTokenInput />
				<CardContent className="space-y-2">
					<div className="flex flex-col gap-x-10 gap-y-3">
						<Field
							className="max-w-[50%]"
							labelProps={{ children: 'Username' }}
							inputProps={{
								...conform.input(fields.username),
								autoFocus: true,
								className: 'lowercase',
								autoComplete: 'username',
							}}
							errors={fields.username.errors}
						/>
						<Field
							className="max-w-[75%]"
							labelProps={{ children: 'Member Name' }}
							inputProps={{
								...conform.input(fields.member),
							}}
							errors={fields.member.errors}
						/>
						<Field
							className="max-w-[75%]"
							labelProps={{ children: 'Primary Email' }}
							inputProps={{
								...conform.input(fields.primaryEmail),
								autoComplete: 'primaryEmail',
							}}
							errors={fields.primaryEmail.errors}
						/>
						<Field
							className="max-w-[75%]"
							labelProps={{ children: 'Secondary Email' }}
							inputProps={{
								...conform.input(fields.secondaryEmail),
								autoComplete: 'secondaryEmail',
							}}
							errors={fields.secondaryEmail.errors}
						/>
						<CardFooter className="justify-end border-b-2 pb-2 text-end">
							<div className="flex flex-row gap-2">
								<Button form={form.id} variant="destructive" type="reset">
									Reset
								</Button>
								<StatusButton form={form.id} type="submit" disabled={isPending} status={isPending ? 'pending' : 'idle'}>
									Submit
								</StatusButton>
							</div>
						</CardFooter>
						{user.phones.map(phone => (
							<UpdatePhone key={phone.id} userId={user.id} phone={phone} />
						))}
						<CreatePhone userId={user.id} />
					</div>
				</CardContent>
			</Form>
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

/*
function PrimaryPhone({ phone, userId }: { phone: { id: string; primary: boolean }; userId: string }) {
	const fetcher = useFetcher<typeof updatePhoneAction>()
	const [form, fields] = useForm({
		id: `${updatePhonePrimaryActionIntent}-${phone.id}`,
		constraint: getFieldsetConstraint(UpdatePhonePrimarySchema),
		lastSubmission: fetcher.data?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: UpdatePhonePrimarySchema })
		},
	})
	return (
		<fetcher.Form method="POST" {...form.props}>
			<AuthenticityTokenInput />
			<input type="hidden" name="id" value={phone.id} />
			<input type="hidden" name="userId" value={userId} />
			<CheckboxSubmit
				checked={phone.primary ?? false}
				labelProps={{ htmlFor: fields.primary.id, children: 'Primary' }}
				buttonProps={{
					name: 'intent',
					value: updatePhonePrimaryActionIntent,
				}}
				inputProps={{
					...conform.input(fields.primary),
				}}
			/>
		</fetcher.Form>
	)
}
*/

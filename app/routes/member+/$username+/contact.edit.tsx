import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node'
import { useLoaderData, type MetaFunction, Form, useFetcher } from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { Field } from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon'
import { StatusButton } from '#app/components/ui/status-button'
import { requireUserId } from '#app/utils/auth.server'
import { validateCSRF } from '#app/utils/csrf.server'
import { prisma } from '#app/utils/db.server.ts'
import { useDoubleCheck, useIsPending } from '#app/utils/misc'
import { generatePublicId } from '#app/utils/public-id'
import { redirectWithToast } from '#app/utils/toast.server'
import { EmailSchema, NameSchema, PhoneSchema, UsernameSchema } from '#app/utils/user-validation'

const UserContactSchema = z.object({
	id: z.string(),
	member: NameSchema.optional(),
	username: UsernameSchema,
	primaryEmail: EmailSchema,
	secondaryEmail: EmailSchema.optional(),
})

const CreatePhoneSchema = z.object({
	userId: z.string(),
	type: z.string(),
	number: PhoneSchema,
})

const UpdatePhoneSchema = z.object({
	userId: z.string(),
	id: z.string(),
	type: z.string(),
	number: PhoneSchema,
	primary: z.boolean().optional().default(false),
})

const UpdatePhonePrimarySchema = z.object({
	userId: z.string(),
	id: z.string(),
	primary: z.boolean().optional().default(false),
})

const DeletePhoneSchema = z.object({
	id: z.string().optional(),
})

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

type ProfileActionArgs = {
	request: Request
	currentUser: string
	formData: FormData
}

const createPhoneActionIntent = 'create-phone'
const updatePhoneActionIntent = 'update-phone'
const updatePhonePrimaryActionIntent = 'update-phone-primary'
const deletePhoneActionIntent = 'delete-phone'

export async function action({ request }: ActionFunctionArgs) {
	const currentUser = await requireUserId(request)
	const formData = await request.formData()
	await validateCSRF(formData, request.headers)
	const intent = formData.get('intent')
	switch (intent) {
		case createPhoneActionIntent: {
			return createPhoneAction({ request, currentUser, formData })
		}
		case updatePhoneActionIntent: {
			return updatePhoneAction({ request, currentUser, formData })
		}
		case updatePhonePrimaryActionIntent: {
			return updatePhonePrimaryAction({ request, currentUser, formData })
		}
		case deletePhoneActionIntent: {
			return deletePhoneAction({ request, currentUser, formData })
		}
		default: {
			throw new Response(`Invalid intent "${intent}"`, { status: 400 })
		}
	}
}

async function createPhoneAction({ formData }: ProfileActionArgs) {
	const submission = await parse(formData, { schema: CreatePhoneSchema, async: true })

	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}

	if (submission.value) {
		const { type, number, userId } = submission.value
		await prisma.userPhone.create({
			select: { id: true },
			data: {
				id: generatePublicId(),
				userId,
				type,
				number,
			},
		})

		return redirectWithToast('', {
			type: 'success',
			title: 'Success',
			description: `New phone number added.`,
		})
	} else {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
}

async function updatePhoneAction({ formData, currentUser }: ProfileActionArgs) {
	const submission = await parse(formData, { schema: UpdatePhoneSchema, async: true })

	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}
	if (submission.value) {
		const { id, userId, ...data } = submission.value
		await prisma.userPhone.update({
			data: {
				...data,
				updatedBy: currentUser,
			},
			where: { id },
		})
		return redirectWithToast('', {
			type: 'success',
			title: 'Success',
			description: `Contact updated.`,
		})
	} else {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
}

async function updatePhonePrimaryAction({ formData, currentUser }: ProfileActionArgs) {
	const submission = await parse(formData, { schema: UpdatePhonePrimarySchema, async: true })

	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}
	if (submission.value) {
		const { id, userId, primary } = submission.value
		await prisma.userPhone.update({
			data: {
				primary,
				updatedBy: currentUser,
			},
			where: { id },
		})

		if (primary) {
			await prisma.userPhone.updateMany({
				data: {
					primary: false,
					updatedBy: currentUser,
				},
				where: { userId, NOT: { id } },
			})
		}

		return redirectWithToast('', {
			type: 'success',
			title: 'Success',
			description: `Phone updated to primary.`,
		})
	} else {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
}

async function deletePhoneAction({ formData }: ProfileActionArgs) {
	const submission = await parse(formData, { schema: DeletePhoneSchema, async: true })

	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}
	if (submission.value) {
		const { id } = submission.value
		await prisma.userPhone.delete({ where: { id } })
		return json({ status: 'success' })
	} else {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
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

function CreatePhone({ userId }: { userId: string }) {
	const fetcher = useFetcher<typeof createPhoneAction>()
	const [form, fields] = useForm({
		id: 'add-new-phone',
		constraint: getFieldsetConstraint(CreatePhoneSchema),
		lastSubmission: fetcher.data?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: CreatePhoneSchema })
		},
		defaultValue: {
			primary: false,
		},
	})
	return (
		<div className="my-2 flex flex-col">
			<CardDescription className="mb-0">Add new phone number:</CardDescription>
			<fetcher.Form method="POST" {...form.props} className="flex flex-row items-end gap-2">
				<AuthenticityTokenInput />
				<input type="hidden" name="userId" value={userId} />
				<Field
					labelProps={{ htmlFor: fields.type.id, children: 'Type' }}
					inputProps={{ ...conform.input(fields.type), className: 'capitalize' }}
					errors={fields.type.errors}
				/>
				<Field
					labelProps={{ htmlFor: fields.number.id, children: 'Number' }}
					inputProps={conform.input(fields.number)}
					errors={fields.number.errors}
				/>
				<StatusButton
					type="submit"
					name="intent"
					variant="default"
					value={createPhoneActionIntent}
					status={fetcher.state !== 'idle' ? 'pending' : fetcher.data?.status ?? 'idle'}
				>
					Save phone
				</StatusButton>
			</fetcher.Form>
		</div>
	)
}

function UpdatePhone({
	phone,
	userId,
}: {
	phone: { id: string; type: string; number: string; primary: boolean }
	userId: string
}) {
	const dc = useDoubleCheck()
	const fetcher = useFetcher<typeof updatePhoneAction>()
	const [form, fields] = useForm({
		id: `${updatePhoneActionIntent}-${phone.id}`,
		constraint: getFieldsetConstraint(UpdatePhoneSchema),
		lastSubmission: fetcher.data?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: UpdatePhoneSchema })
		},
		defaultValue: {
			type: phone.type,
			number: phone.number,
		},
	})
	return (
		<div className="flex flex-row flex-wrap items-end border-b pb-2">
			{/* <PrimaryPhone phone={phone} userId={userId} /> */}
			<fetcher.Form method="POST" {...form.props} className="flex flex-row flex-wrap items-end gap-2">
				<AuthenticityTokenInput />
				<input type="hidden" name="id" value={phone.id} />
				<input type="hidden" name="userId" value={userId} />
				<Field
					labelProps={{ htmlFor: fields.type.id, children: 'Type' }}
					inputProps={{ ...conform.input(fields.type), className: 'capitalize' }}
					errors={fields.type.errors}
				/>
				<Field
					labelProps={{ htmlFor: fields.number.id, children: 'Number' }}
					inputProps={conform.input(fields.number)}
					errors={fields.number.errors}
				/>
				<StatusButton
					type="submit"
					name="intent"
					variant="default"
					value={updatePhoneActionIntent}
					status={fetcher.state !== 'idle' ? 'pending' : fetcher.data?.status ?? 'idle'}
				>
					<Icon name="pencil-2">Update</Icon>
				</StatusButton>
				<Form method="POST">
					<AuthenticityTokenInput />
					<input type="hidden" name="id" value={phone.id} />
					<StatusButton
						{...dc.getButtonProps({
							type: 'submit',
							name: 'intent',
							value: deletePhoneActionIntent,
						})}
						variant={dc.doubleCheck ? 'destructive' : 'default'}
						status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
					>
						<Icon name="trash">{dc.doubleCheck ? `Are you sure?` : `Delete`}</Icon>
					</StatusButton>
				</Form>
			</fetcher.Form>
		</div>
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
import { useForm, conform } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { Form, useFetcher } from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { Field } from '#app/components/forms.tsx'
import { CardDescription } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon'
import { StatusButton } from '#app/components/ui/status-button'
import { requireUserId, sessionKey } from '#app/utils/auth.server'
import { validateCSRF } from '#app/utils/csrf.server'
import { prisma } from '#app/utils/db.server.ts'
import { useDoubleCheck } from '#app/utils/misc'
import { generatePublicId } from '#app/utils/public-id'
import { authSessionStorage } from '#app/utils/session.server'
import { redirectWithToast } from '#app/utils/toast.server'
import { EmailSchema, NameSchema, PhoneNumberSchema, UsernameSchema } from '#app/utils/user-validation.ts'

export const UserContactSchema = z.object({
	id: z.string(),
	member: NameSchema.optional(),
	username: UsernameSchema,
	primaryEmail: EmailSchema,
	secondaryEmail: EmailSchema.optional(),
})

export type ProfileActionArgs = {
	request: Request
	currentUser: string
	formData: FormData
}

export const createPhoneActionIntent = 'create-phone'
export const updatePhoneActionIntent = 'update-phone'
export const deletePhoneActionIntent = 'delete-phone'
export const profileUpdateActionIntent = 'update-profile'
export const signOutOfSessionsActionIntent = 'sign-out-of-sessions'
export const deleteDataActionIntent = 'delete-data'

export async function action({ request }: ActionFunctionArgs) {
	const currentUser = await requireUserId(request)
	const formData = await request.formData()
	await validateCSRF(formData, request.headers)
	const intent = formData.get('intent')
	const event = { request, currentUser, formData }
	switch (intent) {
		case createPhoneActionIntent:
			return createPhoneAction(event)

		case updatePhoneActionIntent:
			return updatePhoneAction(event)

		case deletePhoneActionIntent:
			return deletePhoneAction(event)

		case profileUpdateActionIntent:
			return profileUpdateAction(event)

		case signOutOfSessionsActionIntent:
			return signOutOfSessionsAction(event)

		case deleteDataActionIntent:
			return deleteDataAction(event)

		default: {
			throw new Response(`Invalid intent "${intent}"`, { status: 400 })
		}
	}
}

export const ProfileFormSchema = z.object({
	member: NameSchema.optional(),
	username: UsernameSchema,
	secondaryEmail: EmailSchema.optional(),
})
export async function profileUpdateAction({ currentUser, formData }: ProfileActionArgs) {
	const submission = await parse(formData, {
		async: true,
		schema: ProfileFormSchema.superRefine(async ({ username }, ctx) => {
			const existingUsername = await prisma.user.findUnique({
				where: { username },
				select: { id: true },
			})
			if (existingUsername && existingUsername.id !== currentUser) {
				ctx.addIssue({
					path: ['username'],
					code: z.ZodIssueCode.custom,
					message: 'A user already exists with this username',
				})
			}
		}),
	})
	if (submission.intent !== 'submit') return json({ status: 'idle', submission } as const)
	if (!submission.value) return json({ status: 'error', submission } as const, { status: 400 })
	const data = submission.value
	const { id, username, member, secondaryEmail } = (await prisma.user.findFirst({
		select: { id: true, username: true, member: true, secondaryEmail: true },
		where: { id: currentUser },
	})) ?? { id: null, username: null, member: null, secondaryEmail: null }
	if (id) {
		await prisma.user.update({
			select: { username: true },
			data,
			where: { id: currentUser },
		})
		if (data.username && username !== data.username) {
			await prisma.userAudit.create({
				data: {
					userId: id,
					field: 'username',
					from: username ?? 'new',
					to: data.username,
					updatedAt: new Date(),
					updatedBy: currentUser,
				},
			})
		}
		if (data.member && member !== data.member) {
			await prisma.userAudit.create({
				data: {
					userId: id,
					field: 'member',
					from: member ?? 'new',
					to: data.member,
					updatedAt: new Date(),
					updatedBy: currentUser,
				},
			})
		}
		if (data.secondaryEmail && secondaryEmail !== data.secondaryEmail) {
			await prisma.userAudit.create({
				data: {
					userId: id,
					field: 'secondaryEmail',
					from: secondaryEmail ?? 'new',
					to: data.secondaryEmail,
					updatedAt: new Date(),
					updatedBy: currentUser,
				},
			})
		}
	}

	return json({ status: 'success', submission } as const)
}

export async function signOutOfSessionsAction({ request, currentUser }: ProfileActionArgs) {
	const authSession = await authSessionStorage.getSession(request?.headers.get('cookie'))
	const sessionId = authSession.get(sessionKey)
	invariantResponse(sessionId, 'You must be authenticated to sign out of other sessions')
	await prisma.session.deleteMany({
		where: {
			userId: currentUser,
			id: { not: sessionId },
		},
	})
	return json({ status: 'success' } as const)
}

export const CreatePhoneSchema = z.object({
	userId: z.string(),
	type: z.string(),
	number: PhoneNumberSchema,
})
export async function createPhoneAction({ formData, currentUser }: ProfileActionArgs) {
	const submission = await parse(formData, { schema: CreatePhoneSchema, async: true })
	if (submission.intent !== 'submit') return json({ status: 'idle', submission } as const)
	if (submission.value) {
		const { type, number, userId } = submission.value
		await prisma.userPhone.create({
			data: {
				id: generatePublicId(),
				userId,
				type,
				number,
				updatedBy: currentUser,
			},
		})

		await prisma.userAudit.create({
			data: {
				userId,
				field: 'phone',
				from: 'new',
				to: `${type}: ${number}`,
				updatedAt: new Date(),
				updatedBy: currentUser,
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

export const UpdatePhoneSchema = z.object({
	userId: z.string(),
	id: z.string(),
	type: z.string(),
	number: PhoneNumberSchema,
	primary: z.boolean().optional().default(false),
})
export async function updatePhoneAction({ formData, currentUser }: ProfileActionArgs) {
	const submission = await parse(formData, { schema: UpdatePhoneSchema, async: true })
	if (submission.intent !== 'submit') json({ status: 'idle', submission } as const)
	if (submission.value) {
		const { id, userId, ...data } = submission.value
		const { type, number } = (await prisma.userPhone.findFirst({
			select: { type: true, number: true },
			where: { id },
		})) ?? { type: null, number: null }

		if (data.type !== type || data.number !== number) {
			await prisma.userPhone.update({ data: { ...data, updatedBy: currentUser }, where: { id } })
			await prisma.userAudit.create({
				data: {
					userId,
					field: 'phone',
					from: `${type ?? 'new'}: ${number ?? 'new'}`,
					to: `${data.type}: ${number}`,
					updatedAt: new Date(),
					updatedBy: currentUser,
				},
			})
		}

		return redirectWithToast('', {
			type: 'success',
			title: 'Success',
			description: `Contact updated.`,
		})
	} else {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
}

export const DeletePhoneSchema = z.object({
	id: z.string().optional(),
})

export async function deletePhoneAction({ formData, currentUser }: ProfileActionArgs) {
	const submission = await parse(formData, { schema: DeletePhoneSchema, async: true })
	if (submission.intent !== 'submit') return json({ status: 'idle', submission } as const)
	if (submission.value) {
		const { id } = submission.value
		const deleted = (await prisma.userPhone.delete({
			select: { userId: true, type: true, number: true },
			where: { id },
		})) ?? { userId: null, type: null, number: null }
		if (deleted && deleted.userId) {
			const { userId, type, number } = deleted
			await prisma.userAudit.create({
				data: {
					userId,
					field: 'phone',
					from: `${type}: ${number}`,
					to: 'deleted',
					updatedAt: new Date(),
					updatedBy: currentUser,
				},
			})
		}
		return json({ status: 'success' })
	} else {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
}

async function deleteDataAction({ currentUser }: ProfileActionArgs) {
	await prisma.user.delete({ where: { id: currentUser } })
	return redirectWithToast('/', {
		type: 'success',
		title: 'Data Deleted',
		description: 'All of your data has been deleted',
	})
}

export function CreatePhone({ userId }: { userId: string }) {
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
					status={fetcher.state !== 'idle' ? 'pending' : (fetcher.data?.status ?? 'idle')}
				>
					Save Phone
				</StatusButton>
			</fetcher.Form>
		</div>
	)
}

export function UpdatePhone({
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
					status={fetcher.state !== 'idle' ? 'pending' : (fetcher.data?.status ?? 'idle')}
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

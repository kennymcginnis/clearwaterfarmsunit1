import { useForm, getFormProps, getInputProps } from '@conform-to/react'
import { getZodConstraint, parseWithZod } from '@conform-to/zod'
import { Form, useActionData } from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { Field } from '#app/components/forms.tsx'
import { CardDescription } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon'
import { StatusButton } from '#app/components/ui/status-button'
import { useDoubleCheck, useIsPending } from '#app/utils/misc'
import {
	EmailSchema,
	NameSchema,
	PhoneNumberSchema,
	UsernameSchema,
} from '#app/utils/user-validation.ts'
import { type updatePhoneAction, type createPhoneAction } from './_edit.server'

export const createPhoneActionIntent = 'create-phone'
export const updatePhoneActionIntent = 'update-phone'
export const updatePhonePrimaryActionIntent = 'update-phone-primary'
export const deletePhoneActionIntent = 'delete-phone'
export const profileUpdateActionIntent = 'update-profile'
export const signOutOfSessionsActionIntent = 'sign-out-of-sessions'
export const deleteDataActionIntent = 'delete-data'

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

export const CreatePhoneSchema = z.object({
	userId: z.string(),
	type: z.string(),
	number: PhoneNumberSchema,
})
export function CreatePhone({ userId }: { userId: string }) {
	const actionData = useActionData<typeof createPhoneAction>()
	const [form, fields] = useForm({
		id: createPhoneActionIntent,
		constraint: getZodConstraint(CreatePhoneSchema),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: CreatePhoneSchema })
		},
	})

	const isPending = useIsPending()
	return (
		<div className="my-2 flex flex-col">
			<CardDescription className="mb-0">Add new phone number:</CardDescription>
			<Form
				method="POST"
				{...getFormProps(form)}
				className="flex flex-row items-end gap-2"
			>
				<AuthenticityTokenInput />
				<input type="hidden" name="userId" value={userId} />
				<Field
					labelProps={{ htmlFor: fields.type.id, children: 'Type' }}
					inputProps={{
						...getInputProps(fields.type, { type: 'text' }),
						className: 'capitalize',
					}}
					errors={fields.type.errors}
				/>
				<Field
					labelProps={{ htmlFor: fields.number.id, children: 'Number' }}
					inputProps={getInputProps(fields.number, { type: 'text' })}
					errors={fields.number.errors}
				/>
				<StatusButton
					type="submit"
					name="intent"
					variant="default"
					value={createPhoneActionIntent}
					status={isPending ? 'pending' : (form.status ?? 'idle')}
				>
					Save Phone
				</StatusButton>
			</Form>
		</div>
	)
}

export const UpdatePhoneSchema = z.object({
	userId: z.string(),
	id: z.string(),
	type: z.string(),
	number: PhoneNumberSchema,
	primary: z.boolean().optional().default(false),
})
export function UpdatePhone({
	phone,
	userId,
}: {
	phone: { id: string; type: string; number: string; primary: boolean }
	userId: string
}) {
	const dc = useDoubleCheck()
	const actionData = useActionData<typeof updatePhoneAction>()
	const [form, fields] = useForm({
		id: `${updatePhoneActionIntent}-${phone.id}`,
		constraint: getZodConstraint(UpdatePhoneSchema),
		lastResult: actionData?.result,
		onValidate({ formData }) {
			return parseWithZod(formData, { schema: UpdatePhoneSchema })
		},
		defaultValue: {
			type: phone.type,
			number: phone.number,
		},
	})
	const isPending = useIsPending()
	return (
		<div className="flex flex-row flex-wrap items-end border-b pb-2">
			{/* <PrimaryPhone phone={phone} userId={userId} /> */}
			<Form
				method="POST"
				{...getFormProps(form)}
				className="flex flex-row flex-wrap items-end gap-2"
			>
				<AuthenticityTokenInput />
				<input type="hidden" name="id" value={phone.id} />
				<input type="hidden" name="userId" value={userId} />
				<Field
					labelProps={{ htmlFor: fields.type.id, children: 'Type' }}
					inputProps={{
						...getInputProps(fields.type, { type: 'text' }),
						className: 'capitalize',
					}}
					errors={fields.type.errors}
				/>
				<Field
					labelProps={{ htmlFor: fields.number.id, children: 'Number' }}
					inputProps={getInputProps(fields.number, { type: 'text' })}
					errors={fields.number.errors}
				/>
				<StatusButton
					type="submit"
					name="intent"
					variant="default"
					value={updatePhoneActionIntent}
					status={isPending ? 'pending' : (form.status ?? 'idle')}
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
						status={isPending ? 'pending' : (form.status ?? 'idle')}
					>
						<Icon name="trash">
							{dc.doubleCheck ? `Are you sure?` : `Delete`}
						</Icon>
					</StatusButton>
				</Form>
			</Form>
		</div>
	)
}

import { useForm, conform } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { Form, useFetcher } from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { Field } from '#app/components/forms.tsx'
import { CardDescription } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon'
import { StatusButton } from '#app/components/ui/status-button'
import { useDoubleCheck } from '#app/utils/misc'
import { CreatePhoneSchema, UpdatePhoneSchema } from '#app/utils/user-validation.ts'
import { type action as updatePhoneAction } from './_edit.server.tsx'

const createPhoneActionIntent = 'create-phone'
const updatePhoneActionIntent = 'update-phone'
const deletePhoneActionIntent = 'delete-phone'

export function CreatePhone({ userId }: { userId: string }) {
	const fetcher = useFetcher()
	const [form, fields] = useForm({
		id: 'add-new-phone',
		constraint: getFieldsetConstraint(CreatePhoneSchema),
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
					status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
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
					status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
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

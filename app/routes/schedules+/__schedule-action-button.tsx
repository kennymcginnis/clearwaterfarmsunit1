import { useForm } from '@conform-to/react'
import { Form, useActionData } from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { ErrorList } from '#app/components/forms.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { type action } from '#app/routes/schedule+/actions.server'
import { useIsPending } from '#app/utils/misc.tsx'

export function ScheduleActionButton({
	id,
	icon,
	value,
	text,
	variant,
}: {
	id: string
	icon: 'trash' | 'lock-open-1' | 'lock-closed' | 'envelope-closed'
	value: string
	text: string
	variant: 'default' | 'destructive' | 'secondary'
}) {
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()
	const [form] = useForm({ id: value })
	return (
		<Form method="POST" {...form.props}>
			<AuthenticityTokenInput />
			<input type="hidden" name="scheduleId" value={id} />
			<StatusButton
				type="submit"
				name="intent"
				value={value}
				variant={variant}
				status={isPending ? 'pending' : actionData?.status ?? 'idle'}
				disabled={isPending}
				className="w-full max-md:aspect-square max-md:px-0"
			>
				<Icon name={icon} className="scale-125 max-md:scale-150">
					<span className="overflow-ellipsis text-nowrap max-md:hidden">{text}</span>
				</Icon>
			</StatusButton>
			<ErrorList errors={form.errors} id={form.errorId} />
		</Form>
	)
}

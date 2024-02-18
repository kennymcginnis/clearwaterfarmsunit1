import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { Form } from '@remix-run/react'
import * as React from 'react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { ErrorList, Field } from '#app/components/forms.tsx'
import { HeadCombobox } from '#app/components/head-combobox'
import { Button } from '#app/components/ui/button'
import { Card, CardHeader, CardFooter, CardContent, CardTitle, CardDescription } from '#app/components/ui/card'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { validateCSRF } from '#app/utils/csrf.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { useOptionalAdminUser, useOptionalUser } from '#app/utils/user.ts'

const UserScheduleEditorSchema = z.object({
	userId: z.string(),
	scheduleId: z.string(),
	ditch: z.number(),
	hours: z.number().min(0.5).max(12),
	head: z.number(),
})

export async function action({ request }: ActionFunctionArgs) {
	const currentUser = await requireUserId(request)
	const formData = await request.formData()
	await validateCSRF(formData, request.headers)

	const submission = await parse(formData, {
		schema: () => UserScheduleEditorSchema.transform(async (data, ctx) => data),
		async: true,
	})

	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}

	if (submission.value) {
		const { userId, ditch, scheduleId, hours, head } = submission.value

		await prisma.userSchedule.upsert({
			select: { userId: true, ditch: true, scheduleId: true },
			where: { userId_ditch_scheduleId: { userId, ditch, scheduleId } },
			create: {
				userId,
				scheduleId,
				ditch,
				hours,
				head,
				createdBy: currentUser,
			},
			update: {
				hours,
				head,
				updatedBy: currentUser,
			},
		})

		return redirectWithToast('', {
			type: 'success',
			title: 'Success',
			description: `${hours} hours saved for ditch ${ditch}.`,
		})
	}
}

export function UserScheduleEditor({
	user,
	scheduleId,
	userSchedule,
}: {
	scheduleId: string
	user: {
		id: string
		username: string
	}
	userSchedule: {
		ditch: number
		hours: number
		head: number
	}
}) {
	const isPending = useIsPending()
	const currentUser = useOptionalUser()
	const userIsAdmin = useOptionalAdminUser()
	const canEdit = currentUser?.id === user.id || userIsAdmin

	const [headValue, setHeadValue] = React.useState((userSchedule.head ?? 70).toString())

	const [form, fields] = useForm({
		id: `userschedule-form-ditch-${userSchedule.ditch}`,
		constraint: getFieldsetConstraint(UserScheduleEditorSchema),
		// lastSubmission: actionData?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: UserScheduleEditorSchema })
		},
		defaultValue: {
			hours: userSchedule?.hours ?? '',
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<Card key={userSchedule.ditch} className="bg-muted">
			<Form method="POST" {...form.props}>
				<AuthenticityTokenInput />
				<input type="hidden" name="userId" value={user.id} />
				<input type="hidden" name="scheduleId" value={scheduleId} />
				<input type="hidden" name="ditch" value={userSchedule.ditch} />
				<CardHeader>
					<CardTitle>Ditch {userSchedule.ditch}</CardTitle>
					<CardDescription>{user.username}</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col gap-2">
						<Field
							className="w-[250px]"
							labelProps={{ children: 'Hours' }}
							inputProps={{
								type: 'number',
								...conform.input(fields.hours, { ariaAttributes: true }),
							}}
							errors={fields.hours.errors}
						/>
						<input type="hidden" name="head" value={headValue} />
						<HeadCombobox value={headValue} setValue={setHeadValue} />
					</div>
					<ErrorList id={form.errorId} errors={form.errors} />
				</CardContent>
				{canEdit ? (
					<CardFooter className="flex items-center justify-end gap-2 pr-2 pb-2">
						<Button form={form.id} variant="destructive" type="reset">
							Reset
						</Button>
						<StatusButton form={form.id} type="submit" disabled={isPending} status={isPending ? 'pending' : 'idle'}>
							Submit
						</StatusButton>
					</CardFooter>
				) : null}
			</Form>
		</Card>
	)
}

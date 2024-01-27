import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { Form } from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { ErrorList, Field } from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button'
import { Card, CardHeader, CardFooter, CardContent, CardTitle, CardDescription } from '#app/components/ui/card'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { validateCSRF } from '#app/utils/csrf.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { userHasRole } from '#app/utils/permissions.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { useOptionalUser } from '#app/utils/user.ts'

const UserScheduleEditorSchema = z.object({
	userId: z.string(),
	scheduleId: z.string(),
	ditch: z.number(),
	hours: z.number(),
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

export function UserDitchSchedule({
	port,
	data,
}: {
	port: any
	data: {
		user: {
			id: string
			username: string
			defaultHours: number
			defaultHead: number
		}
		schedule: { id: string; open: boolean; closed: boolean }
		userSchedule: { ditch: number; hours: number; head: number }[]
	}
}) {
	const isPending = useIsPending()
	const user = useOptionalUser()
	const canEdit = user?.id === data.user.id || userHasRole(user, 'admin')

	// const actionData = useActionData<typeof action>()

	const userSchedule = data.userSchedule.find(us => us.ditch === port.ditch)

	const [form, fields] = useForm({
		id: `userschedule-form-ditch-${port.ditch}`,
		constraint: getFieldsetConstraint(UserScheduleEditorSchema),
		// lastSubmission: actionData?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: UserScheduleEditorSchema })
		},
		defaultValue: {
			hours: userSchedule?.hours ?? data.user.defaultHours ?? '',
			head: userSchedule?.head ?? data.user.defaultHead ?? 70,
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<Card key={port.ditch}>
			<Form method="POST" {...form.props}>
				<AuthenticityTokenInput />
				{/*
            This hidden submit button is here to ensure that when the user hits
            "enter" on an input field, the primary form function is submitted
            rather than the first button in the form (which is delete/add image).
        */}
				<button type="submit" className="hidden" />
				<input type="hidden" name="userId" value={data.user.id} />
				<input type="hidden" name="scheduleId" value={data.schedule.id} />
				<input type="hidden" name="ditch" value={port.ditch} />
				<CardHeader>
					<CardTitle>
						Ditch {port.ditch} {port.entry ? `(${port.entry})` : ''}
					</CardTitle>
					<CardDescription>{data.user.username}</CardDescription>
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
						<Field
							className="w-[250px]"
							labelProps={{ children: 'Head' }}
							inputProps={{
								...conform.input(fields.head, { ariaAttributes: true }),
							}}
							errors={fields.head.errors}
						/>
					</div>
					<ErrorList id={form.errorId} errors={form.errors} />
				</CardContent>
				{canEdit ? (
					<CardFooter className="flex items-center justify-end gap-2 rounded-b-lg bg-muted p-4 pl-5 shadow-xl shadow-accent backdrop-blur-sm md:gap-4 md:pl-7">
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

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => <p>No schedule with the id "{params.scheduleId}" exists</p>,
			}}
		/>
	)
}

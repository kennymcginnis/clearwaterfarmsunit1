import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { type Meeting } from '@prisma/client'
import {
	unstable_createMemoryUploadHandler as createMemoryUploadHandler,
	json,
	unstable_parseMultipartFormData as parseMultipartFormData,
	redirect,
	type ActionFunctionArgs,
	type SerializeFrom,
} from '@remix-run/node'
import { Form, useActionData } from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { floatingToolbarClassName } from '#app/components/floating-toolbar.tsx'
import { ErrorList, Field } from '#app/components/forms.tsx'
import { Button } from '#app/components/ui/button.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { validateCSRF } from '#app/utils/csrf.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { generatePublicId } from '#app/utils/public-id'

const dateMinLength = 1
const dateMaxLength = 10

const MeetingEditorSchema = z.object({
	id: z.string().optional(),
	date: z.string().min(dateMinLength).max(dateMaxLength),
})

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request)

	const formData = await parseMultipartFormData(request, createMemoryUploadHandler())
	await validateCSRF(formData, request.headers)

	const submission = await parse(formData, {
		schema: MeetingEditorSchema.superRefine(async (data, ctx) => {
			if (!data.id) return

			const meeting = await prisma.meeting.findUnique({
				select: { id: true },
				where: { id: data.id },
			})
			if (!meeting) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Meeting not found',
				})
			}
		}),
		async: true,
	})

	if (submission.intent !== 'submit') {
		return json({ submission } as const)
	}

	if (!submission.value) {
		return json({ submission } as const, { status: 400 })
	}

	const { id: meetingId, date } = submission.value

	const updatedMeeting = await prisma.meeting.upsert({
		select: { id: true, date: true },
		where: { id: meetingId ?? '__new_meeting__' },
		create: {
			id: generatePublicId(),
			date,
			documents: {
				create: ['agenda', 'minutes'].map(doc => ({
					id: generatePublicId(),
					type: doc,
					title: doc,
					content: Buffer.from(`# Meeting ${doc} ${date}`),
				})),
			},
			updatedAt: userId,
		},
		update: { date, updatedBy: userId },
	})

	return redirect(`/meetings/${updatedMeeting.date}/agenda`)
}

export function MeetingEditor({ meeting }: { meeting?: SerializeFrom<Pick<Meeting, 'id' | 'date'>> }) {
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()

	const [form, fields] = useForm({
		id: 'meeting-editor',
		constraint: getFieldsetConstraint(MeetingEditorSchema),
		lastSubmission: actionData?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: MeetingEditorSchema })
		},
		defaultValue: {
			date: meeting?.date ?? '',
		},
	})

	return (
		<div className="absolute inset-0">
			<Form
				method="POST"
				className="flex h-full flex-col gap-y-4 overflow-y-auto overflow-x-hidden px-10 pb-28 pt-12"
				{...form.props}
				encType="multipart/form-data"
			>
				<AuthenticityTokenInput />
				{/*
					This hidden submit button is here to ensure that when the user hits
					"enter" on an input field, the primary form function is submitted
					rather than the first button in the form (which is delete/add image).
				*/}
				<button type="submit" className="hidden" />
				{meeting ? <input type="hidden" name="id" value={meeting.id} /> : null}
				<div className="flex flex-col gap-1">
					<Field
						labelProps={{ children: 'Date' }}
						inputProps={{
							autoFocus: true,
							...conform.input(fields.date, { ariaAttributes: true }),
						}}
						errors={fields.date.errors}
					/>
				</div>
				<ErrorList id={form.errorId} errors={form.errors} />
			</Form>
			<div className={floatingToolbarClassName}>
				<Button form={form.id} variant="destructive" type="reset">
					Reset
				</Button>
				<StatusButton form={form.id} type="submit" disabled={isPending} status={isPending ? 'pending' : 'idle'}>
					Submit
				</StatusButton>
			</div>
		</div>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: ({ params }) => <p>No meeting with the id "{params.meetingId}" exists</p>,
			}}
		/>
	)
}

import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { type Schedule } from '@prisma/client'
import {
	unstable_createMemoryUploadHandler as createMemoryUploadHandler,
	json,
	unstable_parseMultipartFormData as parseMultipartFormData,
	redirect,
	type ActionFunctionArgs,
	type SerializeFrom,
} from '@remix-run/node'
import { Form, useActionData } from '@remix-run/react'
import { useState } from 'react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary.tsx'
import { floatingToolbarClassName } from '#app/components/floating-toolbar.tsx'
import { ErrorList, Field } from '#app/components/forms.tsx'
import { SourceCombobox } from '#app/components/source-combobox'
import { Button } from '#app/components/ui/button'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { validateCSRF } from '#app/utils/csrf.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { generatePublicId } from '#app/utils/public-id'

const stringRegex = /^\d{4}-[01]\d-[0-3]\d$/

const ScheduleEditorSchema = z.object({
	id: z.string().optional(),
	source: z.string(),
	costPerHour: z.number(),
	date: z.string().regex(stringRegex),
	deadline: z.string().regex(stringRegex),
})

export async function action({ request }: ActionFunctionArgs) {
	const userId = await requireUserId(request)

	const formData = await parseMultipartFormData(request, createMemoryUploadHandler())
	await validateCSRF(formData, request.headers)

	const submission = await parse(formData, {
		schema: ScheduleEditorSchema.superRefine(async (data, ctx) => {
			const existingSchedule = await prisma.schedule.findFirst({
				select: { id: true },
				where: { date: data.date, NOT: { id: data.id } },
			})
			if (existingSchedule) {
				ctx.addIssue({
					path: ['date'],
					code: z.ZodIssueCode.custom,
					message: 'A schedule already exists with this date',
				})
				return
			}

			if (!data.id) return
			const schedule = await prisma.schedule.findUnique({
				select: { id: true },
				where: { id: data.id },
			})
			if (!schedule) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: 'Schedule not found',
				})
			}
		}),
		async: true,
	})

	console.dir({ submission })

	if (submission.intent !== 'submit') {
		return json({ submission } as const)
	}

	if (!submission.value) {
		return json({ submission } as const, { status: 400 })
	}

	const { id: scheduleId, date, deadline, source, costPerHour } = submission.value

	const updatedSchedule = await prisma.schedule.upsert({
		select: { id: true, date: true },
		where: { id: scheduleId ?? '__new_schedule__' },
		create: {
			id: generatePublicId(),
			date,
			deadline,
			source,
			costPerHour,
			updatedBy: userId,
		},
		update: {
			date,
			deadline,
			source,
			costPerHour,
			updatedBy: userId,
		},
	})

	return redirect(`/schedules/${updatedSchedule.date}`)
}

export function ScheduleEditor({
	schedule,
}: {
	schedule?: SerializeFrom<Pick<Schedule, 'id' | 'date' | 'deadline' | 'source' | 'costPerHour'>>
}) {
	const actionData = useActionData<typeof action>()
	const isPending = useIsPending()

	const [sourceValue, setSourceValue] = useState((schedule?.source ?? 'surface').toString())

	const [form, fields] = useForm({
		id: 'schedule-editor',
		constraint: getFieldsetConstraint(ScheduleEditorSchema),
		lastSubmission: actionData?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: ScheduleEditorSchema })
		},
		defaultValue: {
			date: schedule?.date ?? '',
			deadline: schedule?.deadline ?? '',
			source: schedule?.source ?? 'Surface Water',
			costPerHour: schedule?.costPerHour ?? 9,
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
				<input type="hidden" name="id" value={schedule?.id} />
				<div className="flex flex-col gap-1">
					<Field
						className="w-[250px]"
						labelProps={{ children: 'Date' }}
						inputProps={{
							...conform.input(fields.date, { ariaAttributes: true }),
							placeholder: 'yyyy-MM-dd',
						}}
						errors={fields.date.errors}
					/>
					<Field
						className="w-[250px]"
						labelProps={{ children: 'Deadline' }}
						inputProps={{
							...conform.input(fields.deadline, { ariaAttributes: true }),
							placeholder: 'yyyy-MM-dd',
						}}
						errors={fields.deadline.errors}
					/>
					<input type="hidden" name="source" value={sourceValue} />
					<SourceCombobox value={sourceValue} setValue={setSourceValue} />
					<Field
						className="w-[250px]"
						labelProps={{ children: 'Cost Per Hour' }}
						inputProps={{
							type: 'number',
							...conform.input(fields.costPerHour, { ariaAttributes: true }),
						}}
						errors={fields.costPerHour.errors}
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
				404: ({ params }) => <p>No schedule with the id "{params.scheduleId}" exists</p>,
			}}
		/>
	)
}

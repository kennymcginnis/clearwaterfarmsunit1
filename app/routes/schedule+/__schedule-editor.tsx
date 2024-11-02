import { useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { useFetcher } from '@remix-run/react'
import { type SetStateAction, useState } from 'react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { ErrorList, Field } from '#app/components/forms.tsx'
import { Badge } from '#app/components/ui/badge.tsx'
import { Button } from '#app/components/ui/button'
import { Card, CardHeader, CardFooter, CardContent, CardTitle, CardDescription } from '#app/components/ui/card'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { validateCSRF } from '#app/utils/csrf.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { formatHours, useIsPending } from '#app/utils/misc.tsx'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { backgroundColor } from '#app/utils/user-schedule.ts'
import { useOptionalAdminUser, useOptionalUser } from '#app/utils/user.ts'

const UserScheduleEditorSchema = z.object({
	userId: z.string(),
	scheduleId: z.string(),
	portId: z.string(),
	ditch: z.number(),
	hours: z.number().min(0).max(12).optional().default(0),
})

export async function action({ request }: ActionFunctionArgs) {
	const currentUser = await requireUserId(request)
	const formData = await request.formData()
	await validateCSRF(formData, request.headers)

	const submission = await parse(formData, { schema: UserScheduleEditorSchema, async: true })
	if (submission.intent !== 'submit') return json({ status: 'idle', submission })

	if (submission.value) {
		const { userId, scheduleId, portId, ditch, hours } = submission.value

		await prisma.userSchedule.upsert({
			select: { userId: true, scheduleId: true, portId: true },
			where: { userId_scheduleId_portId: { userId, scheduleId, portId } },
			create: {
				userId,
				scheduleId,
				portId,
				hours,
				updatedBy: currentUser,
			},
			update: {
				hours,
				updatedBy: currentUser,
			},
		})

		return redirectWithToast('', {
			type: 'success',
			title: 'Success',
			description: hours ? `${hours} hours saved for ditch ${ditch}.` : `Hours removed from ditch ${ditch}.`,
		})
	} else {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
}

export function UserScheduleEditor({
	user,
	schedule,
	userSchedule,
	previous,
}: {
	user: {
		id: string
		display: string | null
		defaultHours: number
		restricted: boolean | null
		restriction: string | null
	}
	schedule: {
		id: string
		source: string
	}
	userSchedule: {
		port: {
			id: string
			ditch: number
		}
		first: boolean
		crossover: boolean
		last: boolean
		hours: number | null
	}
	previous?: number | null
}) {
	const scheduleEditor = useFetcher<typeof action>()
	const isPending = useIsPending()
	const currentUser = useOptionalUser()
	const userIsAdmin = useOptionalAdminUser()
	const canEdit = (user.restricted !== true && user.id === currentUser?.id) || userIsAdmin

	const handlePrevious = (): void => {
		if (previous) setHoursValue(previous)
	}
	const handleDefault = (): void => {
		if (user.defaultHours) setHoursValue(user.defaultHours)
	}
	const handleHoursChanged = (e: { target: { value: SetStateAction<string> } }) => {
		const { value } = e.target
		if (Number(value) >= 0) setHoursValue(Number(value))
	}

	const [hoursValue, setHoursValue] = useState(userSchedule.hours)

	const [form, fields] = useForm({
		id: 'signup-form',
		constraint: getFieldsetConstraint(UserScheduleEditorSchema),
		lastSubmission: scheduleEditor.data?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: UserScheduleEditorSchema })
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<Card key={userSchedule.port.ditch}>
			<scheduleEditor.Form method="POST" {...form.props}>
				<AuthenticityTokenInput />
				<input type="hidden" name="userId" value={user.id} />
				<input type="hidden" name="scheduleId" value={schedule.id} />
				<input type="hidden" name="portId" value={userSchedule.port.id} />
				<input type="hidden" name="ditch" value={userSchedule.port.ditch} />
				<CardHeader>
					<CardTitle>Ditch {userSchedule.port.ditch}</CardTitle>
					<CardDescription>{user.display}</CardDescription>
				</CardHeader>
				<CardDescription className="mx-3 mb-0 mt-1.5 rounded-sm border-2 border-blue-900 p-2 text-center text-blue-700">
					{userSchedule.hours
						? `You are signed up for ${formatHours(userSchedule.hours)}.`
						: 'You have not signed up for hours.'}
				</CardDescription>
				<CardContent>
					<div className="flex flex-col">
						<div id="charges-pills" className="flex w-full flex-row justify-end">
							{userSchedule.first && (
								<Badge className={`ml-1 capitalize ${backgroundColor('first')}`} variant="outline">
									{'First'}
								</Badge>
							)}
							{userSchedule.crossover && (
								<Badge className={`ml-1 capitalize ${backgroundColor('crossover')}`} variant="outline">
									{'Crossover'}
								</Badge>
							)}
							{userSchedule.last && (
								<Badge className={`ml-1 capitalize ${backgroundColor('last')}`} variant="outline">
									{'Last'}
								</Badge>
							)}
						</div>
						<Field
							className="md:w-[250px]"
							labelProps={{ children: 'Hours' }}
							inputProps={{
								name: 'hours',
								type: 'number',
								step: 0.5,
								min: 0,
								max: 12,
								value: hoursValue || '',
								onChange: handleHoursChanged,
							}}
							errors={fields.hours.errors}
						/>
						<ErrorList errors={form.errors} id={form.errorId} />
					</div>
				</CardContent>
				{canEdit ? (
					<CardFooter className="flex items-center justify-between gap-2 px-2 pb-2">
						<div className="flex gap-1">
							{user.defaultHours > 0 ? (
								<Button variant="secondary" type="reset" onClick={handleDefault}>
									Default
								</Button>
							) : null}
							{previous ? (
								<Button variant="secondary" type="reset" onClick={handlePrevious}>
									Previous
								</Button>
							) : null}
						</div>
						<StatusButton type="submit" disabled={isPending} status={isPending ? 'pending' : 'idle'}>
							Submit
						</StatusButton>
					</CardFooter>
				) : null}
			</scheduleEditor.Form>
		</Card>
	)
}

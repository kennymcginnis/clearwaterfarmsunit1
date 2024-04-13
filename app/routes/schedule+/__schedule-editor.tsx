import { parse } from '@conform-to/zod'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { Form } from '@remix-run/react'
import { type SetStateAction, useState } from 'react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { Field } from '#app/components/forms.tsx'
import { HeadCombobox } from '#app/components/head-combobox'
import { Button } from '#app/components/ui/button'
import { Card, CardHeader, CardFooter, CardContent, CardTitle, CardDescription } from '#app/components/ui/card'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { validateCSRF } from '#app/utils/csrf.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { formatHours, useIsPending } from '#app/utils/misc.tsx'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { useOptionalAdminUser, useOptionalUser } from '#app/utils/user.ts'

const UserScheduleEditorSchema = z.object({
	userId: z.string(),
	scheduleId: z.string(),
	ditch: z.number(),
	hours: z.number().min(0).max(12),
	head: z.number(),
})

export async function action({ request }: ActionFunctionArgs) {
	const currentUser = await requireUserId(request)
	const formData = await request.formData()
	await validateCSRF(formData, request.headers)

	const submission = await parse(formData, { schema: UserScheduleEditorSchema, async: true })
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
	schedule,
	userSchedule,
	previous,
}: {
	user: {
		id: string
		username: string
		defaultHours: number
		defaultHead: number
		restricted: boolean
		restriction: string | null
	}
	schedule: {
		id: string
		source: string
	}
	userSchedule: {
		ditch: number
		hours: number | null
		head: number | null
	}
	previous?: {
		hours: number | null
		head: number | null
	}
}) {
	const isPending = useIsPending()
	const currentUser = useOptionalUser()
	const userIsAdmin = useOptionalAdminUser()
	const canEdit = (!user.restricted && user.id === currentUser?.id) || userIsAdmin

	const formatHeadValue = (head: Number | null) => (locked ? 70 : head ?? 70).toString()

	const handlePrevious = (): void => {
		if (previous && previous.hours && previous.head) {
			setHeadValue(formatHeadValue(previous.head))
			setHoursValue(previous.hours)
		}
	}
	const handleDefault = (): void => {
		if (user.defaultHours && user.defaultHead) {
			setHeadValue(formatHeadValue(user.defaultHead))
			setHoursValue(user.defaultHours)
		}
	}
	const handleHoursChanged = (e: { target: { value: SetStateAction<string> } }) => {
		const { value } = e.target
		if (Number(value) >= 0) setHoursValue(Number(value))
	}

	const locked = schedule.source === 'well'
	const [hoursValue, setHoursValue] = useState(userSchedule.hours || 0)
	const [headValue, setHeadValue] = useState(formatHeadValue(userSchedule.head))

	return (
		<Card key={userSchedule.ditch}>
			<Form method="POST">
				<AuthenticityTokenInput />
				<input type="hidden" name="userId" value={user.id} />
				<input type="hidden" name="scheduleId" value={schedule.id} />
				<input type="hidden" name="ditch" value={userSchedule.ditch} />
				<CardHeader>
					<CardTitle>Ditch {userSchedule.ditch}</CardTitle>
					<CardDescription>{user.username}</CardDescription>
				</CardHeader>
				{userSchedule.hours ? (
					<CardDescription className="mx-3 mb-0 mt-1.5 rounded-sm border-2 border-blue-900 p-2 text-center text-blue-700">
						You are signed up for {formatHours(userSchedule.hours)}.
					</CardDescription>
				) : null}
				<CardContent>
					<div className="flex flex-col gap-2">
						<Field
							className="md:w-[250px]"
							labelProps={{ children: 'Hours' }}
							inputProps={{
								name: 'hours',
								type: 'number',
								step: headValue === '70' ? 0.5 : 1,
								min: 0,
								max: 12,
								value: hoursValue,
								onChange: handleHoursChanged,
							}}
						/>
						<input type="hidden" name="head" value={headValue} />
						<HeadCombobox label="Head" value={headValue} setValue={setHeadValue} locked={locked} />
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
							{previous && previous.hours ? (
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
			</Form>
		</Card>
	)
}

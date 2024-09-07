import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node'
import { useLoaderData, useFetcher } from '@remix-run/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary'
import { Field } from '#app/components/forms.tsx'
import { Card, CardContent, CardHeader, CardTitle } from '#app/components/ui/card'
import { StatusButton } from '#app/components/ui/status-button'
import { requireSelfOrAdmin, requireUserId } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server.ts'
import { useIsPending, formatHours, formatDates } from '#app/utils/misc'
import { redirectWithToast } from '#app/utils/toast.server'

const IrrigationDefaultsSchema = z.object({
	id: z.string(),
	defaultHours: z.number().default(0),
})

export async function loader({ request, params }: LoaderFunctionArgs) {
	await requireSelfOrAdmin({ request, params }, { redirectTo: '/members' })
	const { username } = params
	const user = await prisma.user.findFirst({
		select: {
			id: true,
			defaultHours: true,
			restricted: true,
			restriction: true,
		},
		where: { username },
	})

	const userSchedule = await prisma.userSchedule.findMany({
		where: { user: { username }, hours: { gt: 0 } },
		orderBy: { start: 'desc' },
	})

	const userSchedules = userSchedule.map(({ start, stop, ...us }) => ({
		...us,
		formatted: formatDates({ start, stop }),
	}))
	return json({ user, username, userSchedules })
}

const updateDefaultsActionIntent = 'update-defaults'
export async function action({ request }: ActionFunctionArgs) {
	const currentUser = await requireUserId(request)
	const formData = await request.formData()
	const submission = await parse(formData, { schema: IrrigationDefaultsSchema, async: true })

	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}

	if (submission.value) {
		const { id, defaultHours } = submission.value
		await prisma.user.update({
			where: { id },
			data: { defaultHours, updatedBy: currentUser },
		})

		return redirectWithToast('', {
			type: 'success',
			title: 'Success',
			description: `Defaults hours updated.`,
		})
	} else {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
}

export default function NotesRoute() {
	const { user, userSchedules } = useLoaderData<typeof loader>()
	const isPending = useIsPending()

	const fetcher = useFetcher<typeof action>()
	const [form, fields] = useForm({
		id: `irrigation-defaults`,
		constraint: getFieldsetConstraint(IrrigationDefaultsSchema),
		lastSubmission: fetcher.data?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: IrrigationDefaultsSchema })
		},
		defaultValue: {
			defaultHours: user?.defaultHours ?? 0,
		},
		shouldRevalidate: 'onBlur',
	})

	return (
		<Card>
			<CardHeader>
				<CardTitle>Irrigation Defaults</CardTitle>
				{user?.restricted ? (
					<div className="m-auto mt-2 flex w-[50%] flex-col rounded-md border border-destructive px-3 py-2">
						<div className="text-md text-center uppercase text-foreground-destructive">User Account Restricted</div>
						<div className="text-center text-sm text-foreground-destructive">{user.restriction}</div>
					</div>
				) : null}
			</CardHeader>
			<fetcher.Form method="POST" {...form.props}>
				<CardContent className="flex w-full flex-row justify-stretch gap-2 space-y-2">
					<input type="hidden" name="id" value={user?.id} />
					<Field
						className="col-span-3 flex-1"
						labelProps={{ children: 'Default Hours' }}
						inputProps={{
							type: 'number',
							step: 0.5,
							min: 0,
							max: 12,
							...conform.input(fields.defaultHours),
							autoFocus: true,
						}}
					/>
					<div className="flex w-full flex-1 flex-row items-end gap-2">
						<StatusButton
							type="submit"
							name="intent"
							value={updateDefaultsActionIntent}
							form={form.id}
							disabled={isPending}
							status={fetcher.state !== 'idle' ? 'pending' : fetcher.data?.status ?? 'idle'}
						>
							Submit
						</StatusButton>
					</div>
				</CardContent>
			</fetcher.Form>
			<CardHeader>
				<CardTitle>Irrigation History</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2">
				<main className="flex h-full min-h-[400px] flex-col">
					<table className="w-full">
						{userSchedules.map(({ ditch, hours, formatted }, index) => {
							const [start, stop] = formatted
							return (
								<tr
									key={`userSchedules-${index}`}
									className="flex w-full flex-row justify-between gap-1 rounded-lg bg-muted p-2 mb-1"
								>
									<td className="w-[30%] overflow-hidden text-ellipsis text-nowrap text-left text-body-sm text-muted-foreground">
										Ditch: {ditch}
									</td>
									<td className="w-[10%] overflow-hidden text-ellipsis text-nowrap text-right text-body-sm text-muted-foreground">
										{formatHours(Number(hours))}
									</td>
									<td className="w-[30%] overflow-hidden text-ellipsis text-right text-body-sm text-muted-foreground">
										{start}
									</td>
									<td className="w-[30%] overflow-hidden text-ellipsis text-right text-body-sm text-muted-foreground">
										{stop}
									</td>
								</tr>
							)
						})}
					</table>
				</main>
			</CardContent>
		</Card>
	)
}

export function ErrorBoundary() {
	return (
		<GeneralErrorBoundary
			statusHandlers={{
				404: () => <p>No Schedules found...</p>,
			}}
		/>
	)
}

import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node'
import { useLoaderData, NavLink, Outlet, useFetcher } from '@remix-run/react'
import { useState } from 'react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '#app/components/error-boundary'
import { Field } from '#app/components/forms.tsx'
import { HeadCombobox } from '#app/components/head-combobox'
import { Badge } from '#app/components/ui/badge'
import { Button } from '#app/components/ui/button.tsx'
import { Card, CardContent, CardHeader, CardTitle } from '#app/components/ui/card'
import { StatusButton } from '#app/components/ui/status-button'
import { requireUserId } from '#app/utils/auth.server'
import { validateCSRF } from '#app/utils/csrf.server'
import { prisma } from '#app/utils/db.server.ts'
import { cn, getVariantForState, useIsPending } from '#app/utils/misc'
import { redirectWithToast } from '#app/utils/toast.server'

const IrrigationDefaultsSchema = z.object({
	id: z.string(),
	defaultHours: z.number().default(0),
	defaultHead: z.number().default(70),
})

export async function loader({ params }: LoaderFunctionArgs) {
	const { username } = params
	const user = await prisma.user.findFirst({
		select: {
			defaultHours: true,
			defaultHead: true,
			restricted: true,
			restriction: true,
		},
		where: { username },
	})

	const schedules = await prisma.schedule.findMany({
		select: {
			id: true,
			date: true,
			deadline: true,
			source: true,
			costPerHour: true,
			state: true,
		},
		orderBy: { date: 'desc' },
	})

	invariantResponse(schedules, 'No schedules found', { status: 404 })

	return json({ user, username, schedules })
}

const updateDefaultsActionIntent = 'update-defaults'
export async function action({ request }: ActionFunctionArgs) {
	const currentUser = await requireUserId(request)
	const formData = await request.formData()
	await validateCSRF(formData, request.headers)
	const submission = await parse(formData, { schema: IrrigationDefaultsSchema, async: true })

	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}

	if (submission.value) {
		const { id, defaultHours, defaultHead } = submission.value
		await prisma.user.update({
			where: { id },
			data: {
				defaultHours,
				defaultHead,
				updatedBy: currentUser,
			},
		})

		return redirectWithToast('', {
			type: 'success',
			title: 'Success',
			description: `Defaults hours and head updated.`,
		})
	} else {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
}

export default function NotesRoute() {
	const { user, schedules } = useLoaderData<typeof loader>()
	const isPending = useIsPending()
	const navLinkDefaultClassName =
		'line-clamp-2 block rounded-full md:rounded-r-none py-2 pl-8 pr-6 text-base lg:text-xl'

	const [headValue, setHeadValue] = useState((user?.defaultHead ?? 70).toString())

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
			</CardHeader>
			<fetcher.Form method="POST" {...form.props}>
				<CardContent className="flex w-full flex-row justify-stretch gap-2 space-y-2">
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
					<div className="flex flex-1 flex-col gap-0.5">
						<input type="hidden" name="defaultHead" value={headValue} />
						<HeadCombobox label="Default Head" value={headValue} setValue={setHeadValue} locked={false} />
					</div>
					<div className="flex w-full flex-1 flex-row items-end gap-2">
						<Button form={form.id} variant="destructive" type="reset">
							Reset
						</Button>
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
					<div className="grid w-full grid-cols-1 md:grid-cols-4 md:rounded-lg md:pr-0">
						<ul className="min-h-[144px] overflow-y-auto overflow-x-hidden md:mt-4 md:pb-12">
							{schedules.map(schedule => (
								<li key={schedule.id} className="p-1 md:pr-0">
									<NavLink
										to={schedule.date}
										preventScrollReset
										prefetch="intent"
										className={({ isActive }) => cn(navLinkDefaultClassName, isActive && 'bg-accent')}
									>
										{schedule.date}
										<Badge className="ml-2 capitalize" variant={getVariantForState(schedule.state)}>
											{schedule.state}
										</Badge>
									</NavLink>
								</li>
							))}
						</ul>
						<div className="col-span-1 bg-accent md:col-span-3 md:rounded-lg">
							<Outlet />
						</div>
					</div>
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

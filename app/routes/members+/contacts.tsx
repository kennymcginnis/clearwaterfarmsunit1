import { parse } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs, json, type LoaderFunctionArgs } from '@remix-run/node'
import { Form, useLoaderData, useSubmit } from '@remix-run/react'
import { z } from 'zod'
import { Card, CardContent, CardTitle, CardHeader } from '#app/components/ui/card'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { Separator } from '#app/components/ui/separator'
import { prisma } from '#app/utils/db.server.ts'
import { useDebounce } from '#app/utils/misc'
import { requireUserWithRole } from '#app/utils/permissions'

export async function loader({ request }: LoaderFunctionArgs) {
	await requireUserWithRole(request, 'admin')
	const results = await prisma.user.findMany({
		select: {
			id: true,
			display: true,
			quickbooks: true,
			phones: { select: { type: true, number: true } },
			emailSubject: true,
			primaryEmail: true,
			secondarySubject: true,
			secondaryEmail: true,
		},
	})
	const users = results.map(({ phones, ...results }) => ({ ...results, phones: [...phones, { type: '', number: '' }] }))
	users.sort((a, b) => ((a.display ?? '') > (b.display ?? '') ? 1 : -1))
	return json({ users })
}

type ChangesType = {
	userId: string
	intent: string
	display?: string
	quickbooks?: string
	emailSubject?: string
	primaryEmail?: string
	secondarySubject?: string
	secondaryEmail?: string
}
export const ThemeFormSchema = z.object({
	userId: z.string(),
	intent: z.string(),
	display: z.string().optional(),
	quickbooks: z.string().optional(),
	emailSubject: z.string().optional(),
	primaryEmail: z.string().optional(),
	secondaryEmail: z.string().optional(),
	phones: z.object({ type: z.string(), number: z.string() }).array().optional(),
})
export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const submission = parse(formData, { schema: ThemeFormSchema })
	invariantResponse(submission?.value, 'Invalid submission', { status: 404 })

	const { userId: id, intent } = submission.value

	const user = await prisma.user.findFirst({ where: { id } })
	invariantResponse(user?.id, 'User Not found', { status: 404 })

	if (intent !== 'phones') {
		// @ts-ignore:next-line
		await prisma.user.update({ data: { [intent]: submission.value[intent] }, where: { id } })
		return json({ success: true, submission })
	}
	return json({ status: 'error', submission } as const, { status: 400 })
}

export default function ContactsRoute() {
	const { users } = useLoaderData<typeof loader>()
	const submit = useSubmit()

	const debounceChange = useDebounce((changes: ChangesType) => {
		submit(changes, { method: 'POST' })
	}, 400)

	return (
		<Card className="container mb-6 rounded-none bg-muted p-1 px-0 pb-12 xl:rounded-3xl">
			<CardHeader>
				<CardTitle>Member Contact List</CardTitle>
			</CardHeader>
			<CardContent className="max-h-[600px] space-y-2 overflow-auto">
				{users.map(
					({
						id: userId,
						display,
						quickbooks,
						emailSubject,
						primaryEmail,
						secondarySubject,
						secondaryEmail,
						phones,
					}) => (
						<div key={userId} className="grid grid-cols-12 gap-1">
							<div>
								<Label className="col-span-1 m-1" htmlFor="User Id" children="User Id" />
								<Input className="col-span-1" id="User Id" readOnly={true} defaultValue={userId} />
							</div>
							<Form className="col-span-1" method="POST">
								<Label className="col-span-1 m-1" htmlFor="display" children="Display" />
								<Input
									id="display"
									defaultValue={display ?? ''}
									onChange={e => debounceChange({ userId, intent: 'display', display: e.currentTarget.value })}
								/>
							</Form>
							<Form className="col-span-4" method="POST">
								<Label className="col-span-4 m-1" htmlFor="quickbooks" children="QuickBooks" />
								<Input
									id="quickbooks"
									defaultValue={quickbooks ?? ''}
									onChange={e => debounceChange({ userId, intent: 'quickbooks', quickbooks: e.currentTarget.value })}
								/>
							</Form>
							<div className="col-span-3 flex flex-col">
								{phones.map(({ type, number }) => (
									<div key={number} className="grid grid-cols-4">
										<Label className="col-span-1 m-1" htmlFor="emailSubject" children="Type" />
										<Label className="col-span-3 m-1" htmlFor="primaryEmail" children="Phone Number" />
										<Input id="type" className="col-span-1 capitalize" defaultValue={type ?? ''} readOnly={true} />
										<Input id="number" className="col-span-3" defaultValue={number ?? ''} readOnly={true} />
									</div>
								))}
							</div>
							<div className="col-span-3 flex flex-col">
								<Form className=" gap-1" method="POST">
									<div className="grid grid-cols-4">
										<Label className="col-span-1 m-1" htmlFor="emailSubject" children="Subject" />
										<Label className="col-span-3 m-1" htmlFor="primaryEmail" children="Primary Email" />
										<Input
											id="emailSubject"
											className="col-span-1"
											defaultValue={emailSubject ?? ''}
											onChange={e =>
												debounceChange({ userId, intent: 'emailSubject', emailSubject: e.currentTarget.value })
											}
										/>
										<Input
											id="primaryEmail"
											className="col-span-3"
											defaultValue={primaryEmail ?? ''}
											onChange={e =>
												debounceChange({ userId, intent: 'primaryEmail', primaryEmail: e.currentTarget.value })
											}
										/>
									</div>
								</Form>
								<Form method="POST">
									<div className="grid grid-cols-4">
										<Label className="col-span-1 m-1" htmlFor="secondarySubject" children="Subject" />
										<Label className="col-span-3 m-1" htmlFor="secondaryEmail" children="Secondary Email" />
										<Input
											id="emailSubject"
											className="col-span-1"
											defaultValue={secondarySubject ?? ''}
											onChange={e =>
												debounceChange({ userId, intent: 'secondarySubject', secondarySubject: e.currentTarget.value })
											}
										/>
										<Input
											id="secondaryEmail"
											className="col-span-3"
											defaultValue={secondaryEmail ?? ''}
											onChange={e =>
												debounceChange({ userId, intent: 'secondaryEmail', secondaryEmail: e.currentTarget.value })
											}
										/>
									</div>
								</Form>
							</div>
							<Separator className="col-span-12 mb-1 mt-1" />
						</div>
					),
				)}
			</CardContent>
		</Card>
	)
}

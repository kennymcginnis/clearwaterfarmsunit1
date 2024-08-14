import { useForm, conform } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData, useSubmit, useFetcher } from '@remix-run/react'
import clsx from 'clsx'
import { type FormEvent } from 'react'
import { z } from 'zod'
import Dropdown from '#app/components/Dropdown/Dropdown'
import { PaginationComponent } from '#app/components/pagination'
import { Card, CardContent, CardTitle, CardHeader, CardFooter } from '#app/components/ui/card'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { Separator } from '#app/components/ui/separator'
import { type createPhoneAction, CreatePhoneSchema } from '#app/routes/member+/$username+/_edit'
import { action, getPaginatedContacts } from '#app/routes/members+/contacts+/contacts.server'
import { cn } from '#app/utils/misc'
import { getNewTableUrl } from '#app/utils/pagination/contacts'
import { requireUserWithRole } from '#app/utils/permissions'
import { EmailSchema, PhoneNumberSchema } from '#app/utils/user-validation'

export { action }

export async function loader({ request }: LoaderFunctionArgs) {
	await requireUserWithRole(request, 'admin')
	const data = await getPaginatedContacts(request)
	return json(data)
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
	phoneId?: string
	phoneType?: string
	phoneNumber?: string
}
export const ThemeFormSchema = z.object({
	userId: z.string(),
	intent: z.string(),
	display: z.string().optional(),
	quickbooks: z.string().optional(),
	emailSubject: z.string().optional(),
	primaryEmail: EmailSchema.optional(),
	secondaryEmail: EmailSchema.optional(),
	phoneId: z.string().optional(),
	phoneType: z.string().optional(),
	phoneNumber: PhoneNumberSchema.optional(),
})

export default function ContactsRoute() {
	const { contacts, tableParams, total } = useLoaderData<typeof loader>()
	const submit = useSubmit()

	const handleChange = (changes: ChangesType) => submit(changes, { method: 'POST' })
	const Header = ({ header, className }: { header: string; className: string }) => {
		return (
			<div
				key={`header-${header}`}
				className={cn(
					'flex h-8 px-4 py-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
					className,
				)}
			>
				{header.toUpperCase()}
			</div>
		)
	}

	const SortableHeader = ({ header, className }: { header: string; className: string }) => {
		const isSortingUp = tableParams.sort === header && tableParams.direction === 'asc'
		const isSortingDown = tableParams.sort === header && tableParams.direction === 'desc'
		return (
			<Link
				key={`header-${header}`}
				className={cn(
					'flex h-8 px-4 py-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
					className,
				)}
				to={getNewTableUrl(baseUrl, tableParams, 'sort', header !== 'intent' ? header : undefined)}
			>
				{header.toUpperCase()}
				{header !== 'intent' && isSortingUp && <ChevronUpIcon className="ml-auto w-4" />}
				{header !== 'intent' && isSortingDown && <ChevronDownIcon className="ml-auto w-4" />}
			</Link>
		)
	}

	const baseUrl = '/members/contacts'
	return (
		<Card className="container mb-6 rounded-none bg-muted p-1 px-0 pb-12 xl:rounded-3xl">
			<CardHeader>
				<CardTitle>Member Contact List</CardTitle>
			</CardHeader>
			<div className="grid w-full grid-cols-12 gap-1 border-b-2 p-2 pb-0">
				<Header header="id" className="col-span-1" />
				<SortableHeader header="display" className="col-span-1" />
				<SortableHeader header="quickbooks" className="col-span-4" />
				<Header header="phones" className="col-span-3" />
				<Header header="emails" className="col-span-3" />
			</div>
			<CardContent className="space-y-2 overflow-auto">
				{contacts.map(
					({
						id: userId,
						username,
						display,
						member,
						quickbooks,
						emailSubject,
						primaryEmail,
						secondarySubject,
						secondaryEmail,
						phones,
					}) => (
						<div key={userId} className="grid grid-cols-12 gap-1">
							<div className="col-span-1 flex flex-col">
								<Label className="col-span-1 m-1" htmlFor="User Id" children="User Id" />
								<Input className="col-span-1" id="User Id" readOnly={true} defaultValue={userId} />
							</div>
							<div className="col-span-1 flex flex-col">
								<Label className="col-span-1 m-1" htmlFor="username" children="Username" />
								<Input
									id="username"
									defaultValue={username ?? ''}
									onBlur={e => handleChange({ userId, intent: 'username', username: e.currentTarget.value })}
								/>
								<Label className="col-span-1 m-1" htmlFor="display" children="Display" />
								<Input
									id="display"
									defaultValue={display ?? ''}
									onBlur={e => handleChange({ userId, intent: 'display', display: e.currentTarget.value })}
								/>
							</div>
							<div className="col-span-4 flex flex-col">
								<Label className="col-span-4 m-1" htmlFor="member" children="Member Name" />
								<Input
									id="member"
									defaultValue={member ?? ''}
									onBlur={e => handleChange({ userId, intent: 'member', member: e.currentTarget.value })}
								/>
								<Label className="col-span-4 m-1" htmlFor="quickbooks" children="QuickBooks" />
								<Input
									id="quickbooks"
									defaultValue={quickbooks ?? ''}
									onBlur={e => handleChange({ userId, intent: 'quickbooks', quickbooks: e.currentTarget.value })}
								/>
							</div>
							<div className="col-span-3 flex flex-col">
								{phones.map(({ id: phoneId, type, number }) => (
									<div key={number} className="grid grid-cols-4">
										<Label className="col-span-1 m-1" htmlFor="emailSubject" children="Type" />
										<Label className="col-span-3 m-1" htmlFor="primaryEmail" children="Phone Number" />
										<Input
											id="type"
											className="col-span-1 rounded-r-none capitalize"
											defaultValue={type ?? ''}
											onBlur={e =>
												handleChange({ userId, intent: 'phone-type', phoneId, phoneType: e.currentTarget.value })
											}
										/>
										<Input
											id="number"
											className="col-span-3 rounded-l-none"
											defaultValue={number ?? ''}
											onBlur={e =>
												handleChange({ userId, intent: 'phone-number', phoneId, phoneNumber: e.currentTarget.value })
											}
										/>
									</div>
								))}
								<CreatePhone userId={userId} />
							</div>
							<div className="col-span-3 flex flex-col">
								<div className="grid grid-cols-4">
									<Label className="col-span-1 m-1" htmlFor="emailSubject" children="Subject" />
									<Label className="col-span-3 m-1" htmlFor="primaryEmail" children="Primary Email" />
									<Input
										id="emailSubject"
										className="col-span-1 rounded-r-none"
										defaultValue={emailSubject ?? ''}
										onBlur={e => handleChange({ userId, intent: 'emailSubject', emailSubject: e.currentTarget.value })}
									/>
									<Input
										id="primaryEmail"
										className="col-span-3 rounded-l-none"
										defaultValue={primaryEmail ?? ''}
										onBlur={e => handleChange({ userId, intent: 'primaryEmail', primaryEmail: e.currentTarget.value })}
									/>
								</div>
								<div className="grid grid-cols-4">
									<Label className="col-span-1 m-1" htmlFor="secondarySubject" children="Subject" />
									<Label className="col-span-3 m-1" htmlFor="secondaryEmail" children="Secondary Email" />
									<Input
										id="emailSubject"
										className="col-span-1 rounded-r-none"
										defaultValue={secondarySubject ?? ''}
										onBlur={e =>
											handleChange({ userId, intent: 'secondarySubject', secondarySubject: e.currentTarget.value })
										}
									/>
									<Input
										id="secondaryEmail"
										className="col-span-3 rounded-l-none"
										defaultValue={secondaryEmail ?? ''}
										onBlur={e =>
											handleChange({ userId, intent: 'secondaryEmail', secondaryEmail: e.currentTarget.value })
										}
									/>
								</div>
							</div>
							<Separator className="col-span-12 mb-1 mt-1" />
						</div>
					),
				)}
			</CardContent>
			<CardFooter className="w-full">
				<div className="ml-8 items-center justify-between text-nowrap">
					{total > tableParams.items ? (
						<p className="text-sm tracking-wider">
							Showing <b>{tableParams.items * (tableParams.page - 1) + 1}</b> to{' '}
							<b>{tableParams.items * tableParams.page}</b> of <b>{total}</b> results
						</p>
					) : (
						<p className="text-sm tracking-wider">
							Showing <b>{total}</b> results
						</p>
					)}
				</div>
				<PaginationComponent totalPages={Math.ceil(total / tableParams.items)} pageParam="page" className="mt-8" />
				<div className="mr-2">
					<Dropdown
						itemKey="items"
						items={['10', '25', '50', '100']}
						isRight
						isTop
						buttonChild={`${tableParams.items} items per page`}
						generateItem={(active, item) => (
							<Link
								to={getNewTableUrl(baseUrl, tableParams, 'items', item)}
								className={clsx(
									active || item === tableParams.items.toString() ? 'bg-secondary/80' : 'bg-secondary',
									'block px-4 py-2 text-sm text-secondary-foreground',
								)}
							>
								{item} items per page
							</Link>
						)}
					/>
				</div>
			</CardFooter>
		</Card>
	)
}

function CreatePhone({ userId }: { userId: string }) {
	const fetcher = useFetcher<typeof createPhoneAction>()
	const [form, fields] = useForm({
		id: `create-phone-${userId}`,
		constraint: getFieldsetConstraint(
			z.object({
				userId: z.string(),
				phoneType: z.string(),
				phoneNumber: PhoneNumberSchema,
			}),
		),
		lastSubmission: fetcher.data?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: CreatePhoneSchema })
		},
	})

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		if (fetcher.data?.submission.error) return
		fetcher.submit(event.currentTarget)
	}

	return (
		<fetcher.Form method="POST" {...form.props} className="grid grid-cols-4" onBlur={handleSubmit}>
			<input type="hidden" name="userId" value={userId} />
			<input type="hidden" name="intent" value="create-phone" />
			<Label className="col-span-1 m-1" htmlFor="emailSubject" children="Type" />
			<Label className="col-span-3 m-1" htmlFor="primaryEmail" children="Phone Number" />
			<Input id="type" className="col-span-1 rounded-r-none capitalize" {...conform.input(fields.phoneType)} />
			<Input id="number" className="col-span-3 rounded-l-none" {...conform.input(fields.phoneNumber)} />
		</fetcher.Form>
	)
}

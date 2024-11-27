import { useForm, conform } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData, useFetcher } from '@remix-run/react'
import clsx from 'clsx'
import parsePhoneNumber from 'libphonenumber-js'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import DisplayFilters from '#app/components/DisplayFilters'
import Dropdown from '#app/components/Dropdown/Dropdown'
import { PaginationComponent } from '#app/components/pagination'
import { SearchBar } from '#app/components/search-bar.tsx'
import { Button } from '#app/components/ui/button'
import { Card, CardContent, CardTitle, CardHeader, CardFooter } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { Separator } from '#app/components/ui/separator'
import { StatusButton } from '#app/components/ui/status-button'
import { type createPhoneAction, CreatePhoneSchema } from '#app/routes/member+/$username+/_edit'
import { action, getPaginatedContacts } from '#app/routes/members+/contacts+/contacts.server'
import { cn, useDoubleCheck } from '#app/utils/misc'
import { getNewTableUrl } from '#app/utils/pagination/contacts'
import { requireUserWithRole } from '#app/utils/permissions'
import { PhoneNumberSchema } from '#app/utils/user-validation'

export { action }

export async function loader({ request }: LoaderFunctionArgs) {
	await requireUserWithRole(request, 'admin')
	const data = await getPaginatedContacts(request)
	return json(data)
}

type ChangesType = {
	intent: string
	userId: string
	username?: string
	display?: string
	member?: string
	quickbooks?: string
	emailSubject?: string
	primaryEmail?: string
	secondarySubject?: string
	secondaryEmail?: string
	phoneId?: string
	phoneType?: string
	phoneNumber?: string
}

export default function ContactsRoute() {
	const { contacts, tableParams, displays, total } = useLoaderData<typeof loader>()
	const [showUpload, setShowUpload] = useState(false)
	const toggleShowUpload = () => setShowUpload(!showUpload)

	const fetcher = useFetcher()

	const handleChange = (changes: ChangesType) => fetcher.submit(changes, { method: 'POST' })

	const SortableHeader = ({ header, className }: { header: string; className: string }) => {
		const isSortingUp = tableParams.sort === header && tableParams.direction === 'asc'
		const isSortingDown = tableParams.sort === header && tableParams.direction === 'desc'
		return (
			<Button variant="default" asChild>
				<Link
					key={`header-${header}`}
					className={cn(
						'flex px-4 py-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
						className,
					)}
					to={getNewTableUrl(baseUrl, tableParams, 'sort', header !== 'intent' ? header : undefined)}
				>
					{header.toUpperCase()}
					{header !== 'intent' && isSortingUp && <ChevronUpIcon className="ml-auto w-4" />}
					{header !== 'intent' && isSortingDown && <ChevronDownIcon className="ml-auto w-4" />}
				</Link>
			</Button>
		)
	}

	const formatDitch = (ports: { ditch: number; position: number; section: string; entry: string }[]) =>
		`[${ports[0].entry}] - ${ports.map(({ ditch, position, section }) => `Ditch ${ditch}.${`0${position}`.slice(-2)} - ${section}`).join(' & ')}` // ${section}-${entry}`

	const baseUrl = '/members/contacts'
	return (
		<Card className="m-auto mt-2 flex flex-col items-center justify-center gap-1 bg-accent px-0 pb-4">
			<CardHeader className="flex w-full flex-row flex-wrap gap-2 self-center border-b-sky-950 p-4">
				<div className="flex flex-col items-center">
					<CardTitle>Member Contact List</CardTitle>
				</div>
				<div className="flex gap-2">
					<Button>
						<Link reloadDocument to={`/resources/download/contacts`}>
							<Icon name="download">Contacts</Icon>
						</Link>
					</Button>
					<Button onClick={toggleShowUpload}>
						<Icon name="upload">Upload</Icon>
						{showUpload ? (
							<ChevronDown
								className="relative top-[1px] ml-1 h-4 w-4 transition duration-200 group-data-[state=open]:rotate-180"
								aria-hidden="true"
							/>
						) : (
							<ChevronUp
								className="relative top-[1px] ml-1 h-4 w-4 transition duration-200 group-data-[state=open]:rotate-180"
								aria-hidden="true"
							/>
						)}
					</Button>
				</div>
				{showUpload ? (
					<div className="mt-2 flex w-full flex-row justify-end space-x-2">
						<fetcher.Form method="post" encType="multipart/form-data" action="/members/contacts/upload">
							<input aria-label="File" type="file" accept=".csv" name="selected_csv" />
							<Button type="submit" name="intent" value="upload-contacts" className="btn btn-sm">
								Upload CSV
							</Button>
						</fetcher.Form>
					</div>
				) : null}
			</CardHeader>
			<CardContent className="w-full space-y-2 overflow-auto">
				<div className="flex flex-row flex-wrap justify-around gap-1 lg:flex-nowrap">
					<div className="flex flex-col gap-1.5">
						<div className="text-md ml-2 font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
							Filters:
						</div>
						<div className="flex flex-row gap-1">
							<div className="w-[180px]">
								<Button asChild variant="secondary" className="w-full">
									<Link to={baseUrl}>
										<Icon name="reset" className="scale-100 max-md:scale-125">
											<span className="max-md:hidden">Reset Table</span>
										</Icon>
									</Link>
								</Button>
							</div>
							<div className="w-[180px]">
								<DisplayFilters
									baseUrl={baseUrl}
									dropdownDefault="All Members"
									displays={displays}
									tableParams={tableParams}
								/>
							</div>
						</div>
					</div>
					<div className="flex w-full flex-col justify-end gap-1.5">
						<div className="text-md ml-2 font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
							Search:
						</div>
						<SearchBar action="/members/contacts" status="idle" autoFocus autoSubmit />
					</div>
					<div className="flex flex-col gap-1.5">
						<div className="text-md ml-2 font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
							Sorting:
						</div>
						<div className="flex flex-row gap-1">
							<SortableHeader header="display" className="w-28" />
							<SortableHeader header="quickbooks" className="w-36" />
						</div>
					</div>
				</div>

				<Separator className="col-span-12 mb-1 mt-1 h-1 rounded-sm bg-sky-950" />
				{contacts.map(
					({
						id: userId,
						username,
						display,
						member,
						stripeId,
						userAddress,
						quickbooks,
						emailSubject,
						primaryEmail,
						secondarySubject,
						secondaryEmail,
						phones,
						ports,
					}) => (
						<div key={userId} className="flex w-full flex-row flex-wrap gap-1">
							<div className="flex w-full flex-row items-center gap-1">
								<Button asChild variant="outline">
									<Link
										id="User Id"
										to={`/member/${username}/transactions`}
										className="text-md w-[180px] border-sky-950 bg-muted text-center"
									>
										{userId}
									</Link>
								</Button>
								<Button asChild variant="outline">
									<Link
										id="ditch"
										to={`/member/${username}/irrigation`}
										className="text-md min-w-[180px] border-sky-950 bg-muted text-center"
									>
										{formatDitch(ports)}
									</Link>
								</Button>
							</div>
							<div className="flex flex-col">
								<Label className="m-1" htmlFor="username" children="Username" />
								<Input
									id="username"
									className="w-[180px]"
									defaultValue={username ?? ''}
									onBlur={e => handleChange({ userId, intent: 'username', username: e.currentTarget.value })}
								/>
								<Label className="m-1" htmlFor="display" children="Display Name" />
								<Input
									id="display"
									className="w-[180px]"
									defaultValue={display ?? ''}
									onBlur={e => handleChange({ userId, intent: 'display', display: e.currentTarget.value })}
								/>
								<Label className="m-1" htmlFor="member" children="Stripe ID" />
								<Input id="member" className="w-[180px]" readOnly={true} defaultValue={stripeId ?? ''} />
							</div>
							<div className="flex flex-col">
								<Label className="m-1" htmlFor="quickbooks" children="QuickBooks Name" />
								<Input
									id="quickbooks"
									defaultValue={quickbooks ?? ''}
									onBlur={e => handleChange({ userId, intent: 'quickbooks', quickbooks: e.currentTarget.value })}
								/>
								<Label className="m-1" htmlFor="member" children="CityProperty Name" />
								<Input
									id="member"
									className="w-[600px]"
									defaultValue={member ?? ''}
									onBlur={e => handleChange({ userId, intent: 'member', member: e.currentTarget.value })}
								/>
								{userAddress.map(ua => (
									<>
										<Label className="m-1" htmlFor="address" children="Property Address" />
										<Input id="address" className="w-[600px]" readOnly={true} defaultValue={ua.address.address ?? ''} />
									</>
								))}
							</div>
							<div className="flex flex-col">
								{phones.map(({ id: phoneId, type, number }) => {
									const phoneNumber = parsePhoneNumber(number, 'US')
									const format = phoneNumber ? phoneNumber.formatNational() : ''
									return (
										<div key={number} className="grid w-[500px] grid-cols-4">
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
											<div key={number} className="col-span-3 flex flex-row">
												<Input
													id="number"
													className="rounded-none"
													defaultValue={format}
													onBlur={e =>
														handleChange({
															userId,
															intent: 'phone-number',
															phoneId,
															phoneNumber: e.currentTarget.value,
														})
													}
												/>
												<DeletePhone userId={userId} phoneId={phoneId} />
											</div>
										</div>
									)
								})}
								<CreatePhone key={`create-${userId}-${phones.length}`} userId={userId} index={phones.length} />
							</div>
							<div className="flex flex-col">
								<div className="grid w-[750px] grid-cols-4">
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
							<Separator className="col-span-12 mb-1 mt-1 h-0.5 rounded-sm bg-sky-950" />
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

function CreatePhone({ userId, index }: { userId: string; index: number }) {
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
		<fetcher.Form method="POST" {...form.props} className="grid w-[500px] grid-cols-4" onBlur={handleSubmit}>
			<input type="hidden" name="userId" value={userId} />
			<input type="hidden" name="intent" value="create-phone" />
			<Label className="col-span-1 m-1" htmlFor="emailSubject" children="Type" />
			<Label className="col-span-3 m-1" htmlFor="primaryEmail" children="Phone Number" />
			<Input id="type" className="col-span-1 rounded-r-none capitalize" {...conform.input(fields.phoneType)} />

			<div key={`create-${index}`} className="col-span-3 flex flex-row">
				<Input id="number" className="col-span-3 rounded-none" {...conform.input(fields.phoneNumber)} />
				<StatusButton
					type="submit"
					name="intent"
					value="create-phone"
					className="rounded-l-none pt-1 "
					variant="outline"
					status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
				>
					<Icon name="pencil-2" className="h-4 w-4 text-green-900"></Icon>
				</StatusButton>
			</div>
		</fetcher.Form>
	)
}

function DeletePhone({ userId, phoneId }: { userId: string; phoneId: string }) {
	const fetcher = useFetcher<typeof action>()
	const dc = useDoubleCheck()
	return (
		<fetcher.Form method="POST" key={`delete-${phoneId}`}>
			<input type="hidden" name="userId" value={userId} />
			<input type="hidden" name="phoneId" value={phoneId} />
			<StatusButton
				{...dc.getButtonProps({
					type: 'submit',
					name: 'intent',
					value: 'delete-phone',
				})}
				className={`rounded-l-none ${dc.doubleCheck ? 'text-primary' : 'text-destructive'}`}
				variant={dc.doubleCheck ? 'destructive' : 'outline'}
				status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
			>
				<Icon name="trash" className="h-4 w-4 text-destructive"></Icon>
			</StatusButton>
		</fetcher.Form>
	)
}

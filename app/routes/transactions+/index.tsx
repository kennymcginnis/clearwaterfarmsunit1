import { invariantResponse } from '@epic-web/invariant'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import {
	type ActionFunctionArgs,
	type UploadHandler,
	json,
	type LoaderFunctionArgs,
	unstable_composeUploadHandlers as composeUploadHandlers,
	unstable_createMemoryUploadHandler as createMemoryUploadHandler,
	unstable_parseMultipartFormData as parseMultipartFormData,
} from '@remix-run/node'
import { Form, Link, useLoaderData, useLocation } from '@remix-run/react'
import clsx from 'clsx'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import DateFilters from '#app/components/DateFilters'
import DebitCreditFilters from '#app/components/DebitCreditFilters'
import DitchFilters from '#app/components/DitchFilters'
import Dropdown from '#app/components/Dropdown'
import { PaginationComponent } from '#app/components/pagination'
import { Button } from '#app/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon'
import { Input } from '#app/components/ui/input'
import { csvFileToArray, csvUploadHandler } from '#app/utils/csv-helper'
import { prisma } from '#app/utils/db.server'
import { cn } from '#app/utils/misc.tsx'
import { itemTableSchema, getNewTableUrl } from '#app/utils/pagination/itemTable'
import {
	TransactionAges,
	type TransactionData,
	type Transaction,
	DitchesArray,
} from '#app/utils/pagination/transactions'
import { requireUserWithRole } from '#app/utils/permissions'
import { generatePublicId } from '#app/utils/public-id'
import { redirectWithToast } from '#app/utils/toast.server'
import { DateSchema } from '#app/utils/user-validation'
import { getPaginatedTransactions } from './transactions.server'

export const ordersPaginationSchema = itemTableSchema.merge(
	z.object({
		search: z
			.string()
			.optional()
			.refine(data => !data || !isNaN(parseInt(data)), 'Must search by number'),
		filter: z.enum(['created', 'picked', 'printed', 'shipped', 'cancelled']).optional(), //Zod types suck here so I can't use the arrays OrderFilters / OrderHeaders
		sort: z.enum(['order', 'total', 'status', 'placed on']).optional(),
	}),
)

export async function loader({ request }: LoaderFunctionArgs) {
	const data = await getPaginatedTransactions(request)
	return json(data)
}

const TransactionSchema = z.array(
	z.object({
		id: z.string().optional(),
		userId: z.string().optional(),
		scheduleId: z.string().optional(),
		ditch: z.number().optional(),
		date: DateSchema,
		debit: z.preprocess(x => (x ? x : 0), z.coerce.number()).optional(),
		credit: z.preprocess(x => (x ? x : 0), z.coerce.number()).optional(),
		note: z.string().optional(),
	}),
)
export async function action({ request }: ActionFunctionArgs) {
	const currentUser = await requireUserWithRole(request, 'admin')

	const uploadHandler: UploadHandler = composeUploadHandlers(csvUploadHandler, createMemoryUploadHandler())
	const formData = await parseMultipartFormData(request, uploadHandler)

	const csv = formData.get('selected_csv')
	invariantResponse(typeof csv === 'string', 'selected_csv filename must be a string')

	const transactions = csvFileToArray(csv)
	const result = TransactionSchema.safeParse(transactions)
	if (!result.success) return json({ status: 'error', error: result.error.message } as const, { status: 400 })

	const missingUsers = []
	for (let transaction of result.data) {
		try {
			await prisma.transactions.upsert({
				where: { id: transaction.id ?? '__new_transaction__' },
				create: {
					id: generatePublicId(),
					...transaction,
					updatedBy: currentUser,
				},
				update: {
					...transaction,
					updatedBy: currentUser,
				},
			})
		} catch (error) {
			console.error(JSON.stringify({ error, transaction }, null, 2))
			missingUsers.push(transaction.userId)
		}
	}
	return redirectWithToast('.', {
		type: 'success',
		title: 'Success',
		description: JSON.stringify(missingUsers),
	})
}

export default function ViewTransactions() {
	const { transactions, tableParams, filters, total } = useLoaderData<TransactionData>()
	const toggleEditable = false
	const [editing, setEditing] = useState<string | null>(null)
	const [showUpload, setShowUpload] = useState(false)
	const toggleShowUpload = () => setShowUpload(!showUpload)

	const location = useLocation()
	const baseUrl = '/transactions'

	const Header = ({ header, className }: { header: string; className: string }) => {
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

	const ItemRow = ({ id, scheduleId, ditch, user, date, debit, credit, note }: Transaction) => {
		return (
			<Form method="POST" key={`row-${id}`} className="grid grid-cols-12 gap-1 disabled:cursor-default">
				<button type="submit" className="hidden" />
				<Input id="id" disabled={true} className="col-span-1 disabled:cursor-default" value={id} />
				<Input id="scheduleId" disabled={true} className="col-span-1 disabled:cursor-default" value={scheduleId} />
				<Input id="ditch" disabled={true} className="col-span-1 disabled:cursor-default" value={ditch} />
				<Input id="userId" disabled={true} className="col-span-1 disabled:cursor-default" value={user.id} />
				<Input id="username" disabled={true} className="col-span-2 disabled:cursor-default" value={user.display} />
				<Input id="date" disabled={true} className="col-span-1 text-right disabled:cursor-default" value={date} />
				<Input
					id="debit"
					disabled={editing !== id}
					className="col-span-1 text-right disabled:cursor-default"
					{...(editing === id
						? { defaultValue: debit.toString() ?? '' }
						: { disabled: true, value: debit.toString() ?? '' })}
				/>
				<Input
					id="credit"
					disabled={editing !== id}
					className="col-span-1 text-right disabled:cursor-default"
					{...(editing === id
						? { defaultValue: credit.toString() ?? '' }
						: { disabled: true, value: credit.toString() ?? '' })}
				/>
				<Input
					id="note"
					className={`col-span-${toggleEditable ? '2' : '3'}`}
					{...(editing === id ? { defaultValue: note ?? '' } : { disabled: true, value: note ?? '' })}
				/>
				{toggleEditable ? (
					<div className="flex flex-row items-center gap-1">
						{editing === id ? (
							<>
								<Button
									type="submit"
									name="intent"
									value="save"
									variant="outline"
									size="sm"
									className="h-10 w-10"
									onClick={() => setEditing(null)}
								>
									<Icon name="check" className="scale-125 text-green-900 max-md:scale-150" />
								</Button>
								<Button
									type="reset"
									size="sm"
									variant="outline"
									className="peer-invalid:hidden"
									onClick={() => setEditing(null)}
								>
									<Icon name="reset" className="scale-125 text-blue-900 max-md:scale-150" />
								</Button>
							</>
						) : (
							<Button variant="outline" size="sm" className="h-10 w-10" onClick={() => setEditing(id)}>
								<Icon name="pencil-1" className="scale-125 text-blue-900 max-md:scale-150" />
							</Button>
						)}
					</div>
				) : null}
			</Form>
		)
	}

	return (
		<Card className="m-auto mt-2 flex w-[90%] flex-col items-center justify-center gap-1 rounded-none bg-accent px-0 pb-4 lg:rounded-3xl">
			<CardHeader className="flex w-full flex-row flex-wrap gap-2 self-center p-4">
				<div></div>
				<div className="flex flex-col items-center">
					<CardTitle className="text-3xl">Transactions</CardTitle>
					<CardDescription>Irrigation Accounts</CardDescription>
				</div>
				<div className="flex gap-2">
					<Button>
						<Link reloadDocument to={`/resources/download-transactions${location.search}`}>
							<Icon name="download">Download</Icon>
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
						<Form method="post" encType="multipart/form-data">
							<input aria-label="File" type="file" accept=".csv" name="selected_csv" />
							<Button type="submit" name="intent" value="upload-timeline" className="btn btn-sm">
								Upload CSV
							</Button>
						</Form>
					</div>
				) : null}
			</CardHeader>
			<CardContent className="w-full space-y-2">
				<div className="grid grid-cols-12 gap-1">
					<div className="col-span-1 pr-3">
						<Button asChild variant="secondary">
							<Link to={baseUrl}>
								<Icon name="reset" className="scale-100 max-md:scale-125">
									<span className="max-md:hidden">Reset Table</span>
								</Icon>
							</Link>
						</Button>
					</div>
					<div className="col-span-1 pr-3"></div>
					<div className="col-span-1 pr-3">
						<DitchFilters
							baseUrl={baseUrl}
							dropdownDefault="All Ditches"
							ditches={DitchesArray}
							tableParams={tableParams}
						/>
					</div>
					<div className="col-span-1 pr-3"></div>
					<div className="col-span-2 pr-3"></div>
					<div className="col-span-1 w-full">
						<DateFilters
							ages={TransactionAges}
							baseUrl={baseUrl}
							dropdownDefault="All Dates"
							filters={filters}
							tableParams={tableParams}
						/>
					</div>
					<div className="col-span-2">
						<DebitCreditFilters baseUrl={baseUrl} filters={filters} tableParams={tableParams} />
					</div>
					<div className={`col-span-${toggleEditable ? '2' : '3'} pl-3`}></div>
					{toggleEditable ? <Header header="intent" className="col-span-1 pl-1.5 text-left" /> : null}
				</div>
				<div className="grid grid-cols-12 gap-1">
					<Header header="id" className="col-span-1 pr-3" />
					<Header header="scheduleId" className="col-span-1 pr-3" />
					<Header header="ditch" className="col-span-1 pr-3" />
					<Header header="userId" className="col-span-1 pr-3" />
					<Header header="display" className="col-span-2 pr-3" />
					<Header header="date" className="col-span-1 pr-2 text-right" />
					<Header header="debit" className="col-span-1 pr-3 text-right" />
					<Header header="credit" className="col-span-1 pr-3 text-right" />
					<Header header="note" className={`col-span-${toggleEditable ? '2' : '3'} pl-3`} />
					{toggleEditable ? <Header header="intent" className="col-span-1 pl-1.5 text-left" /> : null}
				</div>
				{transactions && transactions.length ? (
					transactions.map(ItemRow)
				) : (
					<div className="flex w-full justify-center py-4">
						<h4 className="font-medium tracking-wider text-gray-600">No results found</h4>
					</div>
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

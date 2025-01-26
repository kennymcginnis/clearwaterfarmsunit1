import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useFetcher, useLoaderData, useLocation } from '@remix-run/react'
import clsx from 'clsx'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import DateFilters from '#app/components/DateFilters'
import DebitCreditFilters from '#app/components/DebitCreditFilters'
import DisplayFilters from '#app/components/DisplayFilters'
import DitchFilters from '#app/components/DitchFilters'
import Dropdown from '#app/components/Dropdown'
import { PaginationComponent } from '#app/components/pagination'
import QuickbooksFilters from '#app/components/QuickbooksFilters'
import { Button } from '#app/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon'
import { Input } from '#app/components/ui/input'
import { StatusButton } from '#app/components/ui/status-button'
import { cn, useDoubleCheck } from '#app/utils/misc.tsx'
import {
	getNewTableUrl,
	TransactionAges,
	type TransactionData,
	type Transaction,
	DitchesArray,
} from '#app/utils/pagination/transactions'
import { requireUserWithRole } from '#app/utils/permissions'
import { getPaginatedTransactions } from './transactions.server'

export { action } from './transactions.server'

export async function loader({ request }: LoaderFunctionArgs) {
	await requireUserWithRole(request, 'admin')
	const data = await getPaginatedTransactions(request)
	return json(data)
}

type ChangesType = {
	id: string
	intent: string
	scheduleId?: string
	ditch?: string
	userId?: string
	userDisplay?: string
	date?: string
	debit?: string
	credit?: string
	note?: string
}

export default function ViewTransactions() {
	const { transactions, tableParams, filters, total, balance, displays, quickbooks } = useLoaderData<TransactionData>()
	const [showUpload, setShowUpload] = useState(false)
	const toggleShowUpload = () => setShowUpload(!showUpload)

	const location = useLocation()
	const baseUrl = '/members/transactions'

	const fetcher = useFetcher()
	const handleChange = (changes: ChangesType) => fetcher.submit(changes, { method: 'POST' })

	const USDollar = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

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
			<div key={`row-${id}`} className="grid-cols-20 grid gap-1 disabled:cursor-default">
				<button type="submit" className="hidden" />
				<Input id="id" className="col-span-2 disabled:cursor-default" disabled={true} value={id} />
				<Input
					id="scheduleId"
					className="col-span-2 disabled:cursor-default"
					defaultValue={scheduleId}
					onBlur={e => handleChange({ id, intent: 'scheduleId', scheduleId: e.currentTarget.value })}
				/>
				<Input
					id="ditch"
					className="col-span-1 disabled:cursor-default"
					defaultValue={ditch}
					onBlur={e => handleChange({ id, intent: 'ditch', ditch: e.currentTarget.value ?? '' })}
				/>
				<Input id="userId" className="col-span-2 disabled:cursor-default" disabled={true} value={user.id} />
				<Input id="display" className="col-span-2 disabled:cursor-default" disabled={true} value={user.display} />
				<Input id="quickbooks" className="col-span-3 disabled:cursor-default" disabled={true} value={user.quickbooks} />
				<Input
					id="date"
					className="col-span-2 text-right disabled:cursor-default"
					defaultValue={date}
					onBlur={e => handleChange({ id, intent: 'date', date: e.currentTarget.value })}
				/>
				<Input
					id="debit"
					className="col-span-1 text-right disabled:cursor-default"
					defaultValue={debit.toString() ?? ''}
					onBlur={e => handleChange({ id, intent: 'debit', debit: e.currentTarget.value })}
				/>
				<Input
					id="credit"
					className="col-span-1 text-right disabled:cursor-default"
					defaultValue={credit.toString() ?? ''}
					onBlur={e => handleChange({ id, intent: 'credit', credit: e.currentTarget.value })}
				/>
				<div className="rlex-row col-span-4 flex">
					<Input
						id="note"
						className="mr-1"
						defaultValue={note ?? ''}
						onBlur={e => handleChange({ id, intent: 'note', note: e.currentTarget.value })}
					/>
					<DeleteButton id={id} />
				</div>
			</div>
		)
	}

	return (
		<Card className="m-auto mt-2 flex w-full flex-col items-center justify-center gap-1 rounded-none bg-accent px-0 pb-4">
			<CardHeader className="flex w-full flex-row flex-wrap gap-2 self-center p-4">
				<div></div>
				<div className="flex flex-col items-center">
					<CardTitle className="text-3xl">Transactions</CardTitle>
					<CardDescription>Irrigation Accounts</CardDescription>
				</div>
				<div className="flex gap-2">
					<Button>
						<Link reloadDocument to={`/resources/download/transactions${location.search}`}>
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
						<fetcher.Form method="post" encType="multipart/form-data" action="/members/transactions/upload">
							<input aria-label="File" type="file" accept=".csv" name="selected_csv" />
							<Button type="submit" name="intent" value="upload-transactions" className="btn btn-sm">
								Upload CSV
							</Button>
						</fetcher.Form>
					</div>
				) : null}
			</CardHeader>
			<CardContent className="w-full space-y-2">
				<div className="grid-cols-20 grid gap-1">
					<div className="col-span-2">
						<Button asChild variant="secondary" className="w-full">
							<Link to={baseUrl}>
								<Icon name="reset" className="scale-100 max-md:scale-125">
									<span className="max-md:hidden">Reset Table</span>
								</Icon>
							</Link>
						</Button>
					</div>
					<div className="col-span-2"></div>
					<div className="col-span-1">
						<DitchFilters baseUrl={baseUrl} dropdownDefault="All" ditches={DitchesArray} tableParams={tableParams} />
					</div>
					<div className="col-span-2"></div>
					<div className="col-span-2">
						<DisplayFilters
							baseUrl={baseUrl}
							dropdownDefault="All Members"
							displays={displays}
							tableParams={tableParams}
						/>
					</div>
					<div className="col-span-3">
						<QuickbooksFilters
							baseUrl={baseUrl}
							dropdownDefault="All Members"
							quickbooks={quickbooks}
							tableParams={tableParams}
						/>
					</div>
					<div className="col-span-2">
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
					<div
						className={`col-span-4 rounded-md border-2 ${balance < 0 ? 'border-destructive' : 'border-green-900'} px-2`}
					>
						<CardTitle
							className={`text-right text-2xl ${balance < 0 ? 'text-foreground-destructive' : 'text-green-900'}`}
						>
							Balance: {USDollar.format(balance)}
						</CardTitle>
					</div>
				</div>
				<div className="grid-cols-20 grid gap-1">
					<Header header="id" className="col-span-2 pr-3" />
					<Header header="scheduleId" className="col-span-2 pr-3" />
					<Header header="ditch" className="col-span-1 pr-3" />
					<Header header="userId" className="col-span-2 pr-3" />
					<Header header="display" className="col-span-2 pr-3" />
					<Header header="quickbooks" className="col-span-3 pr-3" />
					<Header header="date" className="col-span-2 pr-2 text-right" />
					<Header header="debit" className="col-span-1 pr-3 text-right" />
					<Header header="credit" className="col-span-1 pr-3 text-right" />
					<Header header="note" className="col-span-4 pl-3" />
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

function DeleteButton({ id }: { id: string }) {
	const fetcher = useFetcher()
	const dc = useDoubleCheck()
	return (
		<fetcher.Form method="POST" key={`delete-${id}`}>
			<input type="hidden" name="id" value={id} />
			<StatusButton
				{...dc.getButtonProps({
					type: 'submit',
					name: 'intent',
					value: 'delete-transaction',
				})}
				className={`w-[120px] ${dc.doubleCheck ? 'text-primary' : 'text-destructive'}`}
				variant={dc.doubleCheck ? 'destructive' : 'default'}
				status={fetcher.state !== 'idle' ? 'pending' : 'idle'}
			>
				{dc.doubleCheck ? (
					`Are you sure?`
				) : (
					<Icon name="trash" className="h-4 w-4 text-destructive">
						Delete
					</Icon>
				)}
			</StatusButton>
		</fetcher.Form>
	)
}

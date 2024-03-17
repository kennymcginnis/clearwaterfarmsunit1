import { parse } from '@conform-to/zod'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { type LoaderFunctionArgs, json, type ActionFunctionArgs } from '@remix-run/node'
import { Form, Link, useLoaderData, useLocation } from '@remix-run/react'
import clsx from 'clsx'
import { useState } from 'react'
import { z } from 'zod'
import DateFilters from '#app/components/DateFilters'
import Dropdown from '#app/components/Dropdown'
import { PaginationComponent } from '#app/components/pagination'
import { Button } from '#app/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon'
import { Input } from '#app/components/ui/input'
import { requireUserId } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server'
import { cn } from '#app/utils/misc.tsx'
import { itemTableSchema, getNewTableUrl } from '#app/utils/pagination/itemTable'
import { TransactionAges, type TransactionData, type Transaction } from '#app/utils/pagination/transactions'
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

const TransactionSchema = z.object({
	id: z.string(),
	username: z.string(),
	date: DateSchema,
	debit: z.number().optional(),
	credit: z.number().optional(),
	note: z.string(),
})
export async function action({ request }: ActionFunctionArgs) {
	const currentUser = await requireUserId(request)
	const formData = await request.formData()
	const intent = formData.get('intent')
	console.log({ intent })
	switch (intent) {
		case 'delete':
			break
		case 'save':
			const submission = await parse(formData, { schema: TransactionSchema, async: true })

			if (submission.intent !== 'submit') {
				return json({ status: 'idle', submission } as const)
			}
			if (submission.value) {
				const { id, username, ...data } = submission.value
				await prisma.transactions.update({
					select: { id: true },
					where: { id },
					data: {
						...data,
						updatedBy: currentUser,
					},
				})
				break
			}
	}
	return null
}

export default function ViewTransactions() {
	const { transactions, tableParams, filters, total } = useLoaderData<TransactionData>()
	const [editing, setEditing] = useState<string | null>(null)

	const location = useLocation()
	console.dir({ location })
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

	const ItemRow = ({ id, user, date, debit, credit, note }: Transaction) => {
		return (
			<Form method="POST" key={`row-${id}`} className="grid grid-cols-12 gap-1">
				{/*
					This hidden submit button is here to ensure that when the user hits
					"enter" on an input field, the primary form function is submitted
					rather than the first button in the form (which is delete/add image).
				*/}
				<button type="submit" className="hidden" />
				<Input id="id" disabled={true} className="col-span-2" value={id} />
				<Input id="username" disabled={true} className="col-span-2" value={user.username} />
				<Input id="date" disabled={editing !== id} className="col-span-1 text-right" value={date} />
				{editing === id ? (
					<Input
						id="debit"
						disabled={editing !== id}
						className="col-span-1 text-right"
						defaultValue={debit.toString() ?? ''}
					/>
				) : (
					<Input
						id="debit"
						disabled={editing !== id}
						className="col-span-1 text-right"
						value={debit.toString() ?? ''}
					/>
				)}
				{editing === id ? (
					<Input
						id="credit"
						disabled={editing !== id}
						className="col-span-1 text-right"
						defaultValue={credit.toString() ?? ''}
					/>
				) : (
					<Input
						id="credit"
						disabled={editing !== id}
						className="col-span-1 text-right"
						value={credit.toString() ?? ''}
					/>
				)}
				{editing === id ? (
					<Input id="note" disabled={editing !== id} className="col-span-4" defaultValue={note ?? ''} />
				) : (
					<Input id="note" disabled={editing !== id} className="col-span-4" value={note ?? ''} />
				)}
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
						<>
							<Button variant="outline" size="sm" className="h-10 w-10" onClick={() => setEditing(id)}>
								<Icon name="pencil-1" className="scale-125 text-blue-900 max-md:scale-150" />
							</Button>
							<Form method="POST">
								<input type="hidden" name={id} value={id} />
								<Button type="submit" name="intent" value="delete" variant="outline" size="sm" className="h-10 w-10">
									<Icon name="trash" className="scale-125 text-red-900 max-md:scale-150" />
								</Button>
							</Form>
						</>
					)}
				</div>
			</Form>
		)
	}

	return (
		<Card className="m-6 rounded-none bg-accent px-0 pb-12 lg:rounded-3xl">
			<pre>{JSON.stringify(location, null, 2)}</pre>
			<CardHeader>
				<DateFilters
					ages={TransactionAges}
					baseUrl={baseUrl}
					dropdownDefault="All Dates"
					filters={filters}
					tableParams={tableParams}
				/>
				<div className="flex flex-col items-center">
					<CardTitle>Transactions</CardTitle>
					<CardDescription>Irrigation Accounts</CardDescription>
				</div>
				<div className="flex gap-2">
					<Button>
						<Link reloadDocument to={`/resources/download-transactions${location.search}`}>
							<Icon name="download">Download</Icon>
						</Link>
					</Button>
					<Button variant="secondary">
						<Link className="text-brand-400 hover:text-brand-800 text-sm tracking-wide" to={baseUrl}>
							Reset Table
						</Link>
					</Button>
				</div>
			</CardHeader>
			<CardContent className="space-y-2">
				<div className="grid grid-cols-12 gap-1">
					<Header header="id" className="col-span-2 pr-3" />
					<Header header="username" className="col-span-2 pr-3" />
					<Header header="date" className="col-span-1 pr-2 text-right" />
					<Header header="debit" className="col-span-1 pr-3 text-right" />
					<Header header="credit" className="col-span-1 pr-3 text-right" />
					<Header header="note" className="col-span-4 pl-3" />
					<Header header="intent" className="col-span-1 pl-1.5 text-left" />
				</div>
				{transactions && transactions.length ? (
					transactions.map(ItemRow)
				) : (
					<div className="flex w-full justify-center py-4">
						<h4 className="font-medium tracking-wider text-gray-600">No results found</h4>
					</div>
				)}
			</CardContent>
			<CardFooter>
				{total > tableParams.items ? (
					<div className="ml-8 items-center justify-between text-nowrap">
						<p className="text-sm tracking-wider">
							Showing <b>{tableParams.items * (tableParams.page - 1) + 1}</b> to{' '}
							<b>{tableParams.items * tableParams.page}</b> of <b>{total}</b> results
						</p>
					</div>
				) : null}
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

import { parse } from '@conform-to/zod'
import { type LoaderFunctionArgs, json, type ActionFunctionArgs } from '@remix-run/node'
import { Form, useLoaderData, useSearchParams } from '@remix-run/react'
import { useEffect, useState } from 'react'
import { z } from 'zod'
import { PaginationComponent } from '#app/components/pagination'
import { Button } from '#app/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon'
import { Input } from '#app/components/ui/input'
import { Label } from '#app/components/ui/label'
import { requireUserId } from '#app/utils/auth.server'
import { prisma } from '#app/utils/db.server'
import { getItemTableParams, itemTableSchema } from '#app/utils/itemTable'
import { DateSchema } from '#app/utils/user-validation'

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
	const tableParams = getItemTableParams(request, ordersPaginationSchema)
	const transactions = await prisma.transactions.findMany({
		select: {
			id: true,
			date: true,
			debit: true,
			credit: true,
			note: true,
			user: { select: { username: true } },
		},
		skip: tableParams.items * (tableParams.page - 1),
		take: tableParams.items,
	})

	const getCount = await prisma.transactions.count({
		// where: filter.where,
	})

	return json({
		transactions,
		totalPages: Math.ceil(getCount / tableParams.items),
	} as const)
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
			return null
	}
}

export default function ViewOrders() {
	const { transactions, totalPages } = useLoaderData<typeof loader>()
	const [editing, setEditing] = useState<number | null>(null)

	const [searchParams] = useSearchParams() // setSearchParams
	const id = searchParams.get('page')
	useEffect(() => setEditing(null), [id])

	return (
		<Card className="m-6 rounded-none bg-accent px-0 pb-12 lg:rounded-3xl">
			<CardHeader>
				<CardTitle>Transactions</CardTitle>
				<CardDescription>Irrigation Accounts</CardDescription>
			</CardHeader>
			<CardContent className="space-y-2">
				<div className="grid grid-cols-12 gap-1">
					<Label htmlFor="id" children="id" className="col-span-2 pr-3" />
					<Label htmlFor="username" children="Username" className="col-span-2 pr-3" />
					<Label htmlFor="date" children="Date" className="col-span-1 pr-2 text-right" />
					<Label htmlFor="debit" children="Debit" className="col-span-1 pr-3 text-right" />
					<Label htmlFor="credit" children="Credit" className="col-span-1 pr-3 text-right" />
					<Label htmlFor="note" children="Note" className="col-span-4 pl-3" />
					<Label htmlFor="intent" children="Edit/Delete" className="col-span-1 pl-1.5 text-left" />
				</div>
				{transactions.map((lineItem, i) => (
					<Form method="POST" key={`row-${i}`} className="grid grid-cols-12 gap-1">
						<Input id="id" disabled={true} className="col-span-2" value={lineItem.id} />
						<Input id="username" disabled={true} className="col-span-2" value={lineItem.user?.username} />
						<Input id="date" disabled={editing !== i} className="col-span-1 text-right" value={lineItem.date} />
						{editing === i ? (
							<Input
								id="debit"
								disabled={editing !== i}
								className="col-span-1 text-right"
								defaultValue={lineItem.debit?.toString() ?? ''}
							/>
						) : (
							<Input
								id="debit"
								disabled={editing !== i}
								className="col-span-1 text-right"
								value={lineItem.debit?.toString() ?? ''}
							/>
						)}
						{editing === i ? (
							<Input
								id="credit"
								disabled={editing !== i}
								className="col-span-1 text-right"
								defaultValue={lineItem.credit?.toString() ?? ''}
							/>
						) : (
							<Input
								id="credit"
								disabled={editing !== i}
								className="col-span-1 text-right"
								value={lineItem.credit?.toString() ?? ''}
							/>
						)}
						{editing === i ? (
							<Input id="note" disabled={editing !== i} className="col-span-4" defaultValue={lineItem.note ?? ''} />
						) : (
							<Input id="note" disabled={editing !== i} className="col-span-4" value={lineItem.note ?? ''} />
						)}
						<div className="flex flex-row items-center gap-1">
							{editing === i ? (
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
							) : (
								<Button variant="outline" size="sm" className="h-10 w-10" onClick={() => setEditing(i)}>
									<Icon name="pencil-1" className="scale-125 text-blue-900 max-md:scale-150" />
								</Button>
							)}
							<Form method="POST">
								<input type="hidden" name={lineItem.id} value={lineItem.id} />
								<Button type="submit" name="intent" value="delete" variant="outline" size="sm" className="h-10 w-10">
									<Icon name="trash" className="scale-125 text-red-900 max-md:scale-150" />
								</Button>
							</Form>
						</div>
					</Form>
				))}
			</CardContent>
			<CardFooter>
				<PaginationComponent totalPages={totalPages} pageParam="page" className="mt-8" />
			</CardFooter>
		</Card>
	)
}

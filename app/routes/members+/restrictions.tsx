import { parse } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs, json, type LoaderFunctionArgs, redirect } from '@remix-run/node'
import { Form, useLoaderData, useSubmit } from '@remix-run/react'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#app/components/ui/card'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { Switch } from '#app/components/ui/switch'
import { prisma } from '#app/utils/db.server.ts'
import { formatCurrency, useDebounce } from '#app/utils/misc'
import { requireUserWithRole } from '#app/utils/permissions'

export async function loader({ request }: LoaderFunctionArgs) {
	await requireUserWithRole(request, 'admin')
	const results = await prisma.user.findMany({
		select: {
			id: true,
			member: true,
			restricted: true,
			restriction: true,
		},
	})

	type UserMapType = { [key: string]: UserType }
	type UserType = {
		id: string
		member: string | null
		restricted: boolean
		restriction: string | null
		debit?: string
		credit?: string
		balance: number
	}
	const userMap = results.reduce(
		(agg, cur): UserMapType => ((agg[cur.id] = { ...cur, balance: 0 }), agg),
		{} as UserMapType,
	)

	const currentBalance = await prisma.transactions.groupBy({
		by: ['userId'],
		_sum: { debit: true, credit: true },
	})

	currentBalance.forEach(b => {
		const userId = b.userId ?? '',
			debit = formatCurrency(b._sum.debit),
			credit = formatCurrency(b._sum.credit),
			balance = (b._sum.debit ?? 0) - (b._sum.credit ?? 0),
			cur = userMap[userId]
		userMap[userId] = { ...cur, debit, credit, balance }
	})

	const users = Object.values(userMap)
		// .filter(cur => cur.restricted || cur.balance < 0)
		.sort((a, b) => {
			const isRestricted = Number(b.restricted) - Number(a.restricted)
			if (isRestricted !== 0) return isRestricted
			return a.balance - b.balance
		})
	return json({ users })
}

export const RestrictionsFormSchema = z.object({
	userId: z.string(),
	intent: z.string(),
	restricted: z
		.enum(['true', 'false'])
		.transform(value => value === 'true')
		.optional(),
	restriction: z.string().optional(),
})
export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const submission = parse(formData, { schema: RestrictionsFormSchema })
	invariantResponse(submission?.value, 'Invalid submission', { status: 404 })

	const { userId: id, intent, restricted, restriction } = submission.value

	switch (intent) {
		case 'restricted': {
			await prisma.user.update({
				data: { restricted, restriction: restriction ?? null },
				where: { id },
			})
			return redirect('')
		}
		case 'restriction': {
			await prisma.user.update({
				data: { restriction: restriction ?? null },
				where: { id },
			})
			return redirect('')
		}
	}
	return json({ status: 'error', submission } as const, { status: 400 })
}

export default function TransactionsRoute() {
	const { users } = useLoaderData<typeof loader>()
	const submit = useSubmit()
	const USDollar = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

	const handleCheckedChange = ({
		userId,
		restricted,
		balance,
	}: {
		userId: string
		restricted: boolean
		balance: number
	}) => {
		const restriction = restricted ? `Restricted for Irrigation Balance ${USDollar.format(balance)}` : ''
		submit({ userId, intent: 'restricted', restricted, restriction }, { method: 'POST' })
	}
	const handleRestrictionChange = useDebounce(({ userId, restriction }: { userId: string; restriction: string }) => {
		submit({ userId, intent: 'restriction', restriction }, { method: 'POST' })
	}, 400)

	return (
		<Card className="container mb-6 rounded-none bg-muted px-0 pb-12 xl:rounded-3xl">
			<CardHeader className="">
				<CardTitle>Restricted Members and Balances</CardTitle>
				<CardDescription>Use this form to Add/Remove Irrigation Restrictions</CardDescription>
				<div className="mr-6 flex flex-col">
					<span className="text-foreground-destructive">Restricted</span>
					<span className="text-nowrap text-green-900">Not Restricted</span>
				</div>
			</CardHeader>
			<CardContent className="max-h-[600px] space-y-2 overflow-auto">
				<div className="grid grid-cols-12 gap-1">
					<Label className="col-span-2 m-1" htmlFor="User Id" children="User Id" />
					<Label className="col-span-3 m-1" htmlFor="Member" children="Member" />
					<Label className="col-span-2 m-1 pr-3 text-right" htmlFor="Balance" children="Balance" />
					<Label className="col-span-4 m-1" children="Restriction" />
					<Label className="col-span-1 m-1" children="Restricted" />
				</div>
				{users.map(({ id: userId, member, restricted, restriction, balance }) => (
					<div key={userId} className="grid grid-cols-12 gap-1">
						<Input className="col-span-2" id="User Id" readOnly={true} defaultValue={userId} />
						<Input className="col-span-3" id="Member" readOnly={true} defaultValue={member ?? ''} />
						<Input
							className="col-span-2 text-right"
							id="Balance"
							readOnly={true}
							defaultValue={USDollar.format(balance)}
						/>
						<div className="col-span-4 flex items-center space-x-2">
							<Form method="POST" className="w-full">
								<Input
									id="restriction"
									defaultValue={restriction ?? ''}
									onChange={e => handleRestrictionChange({ userId, restriction: e.currentTarget.value })}
								/>
							</Form>
						</div>
						<div className="col-span-1 flex items-center space-x-2">
							<Switch
								id="Restricted"
								checked={restricted}
								className="border-2 data-[state=checked]:bg-red-900 data-[state=unchecked]:bg-green-950"
								onCheckedChange={restricted => handleCheckedChange({ userId, restricted, balance })}
							/>
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	)
}

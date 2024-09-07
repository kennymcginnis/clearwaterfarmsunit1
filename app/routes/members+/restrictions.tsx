import { parse } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { type ActionFunctionArgs, json, type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData, useSubmit } from '@remix-run/react'
import { z } from 'zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { ToggleGroup, ToggleGroupItem } from '#app/components/ui/toggle-group'
import { prisma } from '#app/utils/db.server.ts'
import { formatCurrency } from '#app/utils/misc'
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
		restricted: boolean | null
		restriction: string | null
		debit?: string
		credit?: string
		balance: number
	}
	const userMap = results.reduce(
		// eslint-disable-next-line no-sequences
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
			const left = a.restricted === null ? -1 : Number(a.restricted)
			const right = b.restricted === null ? -1 : Number(b.restricted)
			const isRestricted = right - left
			if (isRestricted !== 0) return isRestricted
			return a.balance - b.balance
		})
	return json({ users })
}

export const RestrictionsFormSchema = z.object({
	userId: z.string(),
	intent: z.string(),
	restricted: z
		.enum(['true', 'false', 'null'])
		.transform(value => (value === 'null' ? null : value === 'true'))
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
				data: { restricted, restriction },
				where: { id },
			})
			return null
		}
		case 'restriction': {
			await prisma.user.update({
				data: { restriction: restriction ?? null },
				where: { id },
			})
			return null
		}
	}
	return json({ status: 'error', submission } as const, { status: 400 })
}

export default function TransactionsRoute() {
	const { users } = useLoaderData<typeof loader>()
	const submit = useSubmit()
	const USDollar = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

	const handleCheckedChange = ({ userId, restricted }: { userId: string; restricted: boolean | null }) => {
		submit({ userId, intent: 'restricted', restricted }, { method: 'POST' })
	}
	const handleRestrictionChange = ({ userId, restriction }: { userId: string; restriction: string | null }) => {
		submit({ userId, intent: 'restriction', restriction }, { method: 'POST' })
	}

	return (
		<Card className="container mb-6 rounded-none bg-muted px-0 pb-12 xl:rounded-3xl">
			<CardHeader className="">
				<CardTitle>Restricted Members and Balances</CardTitle>
				<CardDescription>Use this form to Add/Remove Irrigation Restrictions</CardDescription>
				<div className="mr-6 flex gap-3">
					<span className="text-nowrap text-green-900">Not Restricted</span>
					<span className="text-foreground-destructive">Restricted</span>
				</div>
			</CardHeader>
			<CardContent className="space-y-2 overflow-auto">
				<div className="grid grid-cols-12 gap-1">
					<Label className="col-span-2 m-1" htmlFor="User Id" children="User Id" />
					<Label className="col-span-3 m-1" htmlFor="Member" children="Member" />
					<Label className="col-span-1 m-1 pr-3 text-right" htmlFor="Balance" children="Balance" />
					<Label className="col-span-4 m-1" children="Restriction" />
					<Label className="col-span-2 m-1" children="Restricted" />
				</div>
				{users.map(({ id: userId, member, restricted, restriction, balance }) => (
					<div key={userId} className="grid grid-cols-12 gap-1">
						<Link to="" className="col-span-2">
							<Input id="User Id" readOnly={true} defaultValue={userId} />
						</Link>
						<Input className="col-span-3" id="Member" readOnly={true} defaultValue={member ?? ''} />
						<Input
							className="col-span-1 text-right"
							id="Balance"
							readOnly={true}
							defaultValue={USDollar.format(balance)}
						/>
						<div className="col-span-4 flex items-center space-x-2">
							<Input
								id="restriction"
								defaultValue={restriction ?? ''}
								onBlur={e => handleRestrictionChange({ userId, restriction: e.currentTarget.value })}
							/>
						</div>
						<div className="col-span-2 flex items-center space-x-2">
							<ToggleGroup type="single" variant="outline" value={restricted === null ? 'null' : restricted.toString()}>
								<ToggleGroupItem
									value="false"
									aria-label="Toggle bold"
									className="data-[state=on]:bg-green-800 data-[state=on]:text-secondary"
									onClick={() => handleCheckedChange({ userId, restricted: false })}
								>
									<Icon className="h-4 w-4" name="check" />
								</ToggleGroupItem>
								<ToggleGroupItem
									value="null"
									aria-label="Toggle italic"
									className="data-[state=on]:bg-blue-800 data-[state=on]:text-secondary"
									onClick={() => handleCheckedChange({ userId, restricted: null })}
								>
									Auto
								</ToggleGroupItem>
								<ToggleGroupItem
									value="true"
									aria-label="Toggle strikethrough"
									className="data-[state=on]:bg-red-800 data-[state=on]:text-secondary"
									onClick={() => handleCheckedChange({ userId, restricted: true })}
								>
									<Icon className="h-4 w-4" name="cross-2" />
								</ToggleGroupItem>
							</ToggleGroup>
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	)
}

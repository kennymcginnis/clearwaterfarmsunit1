import { invariantResponse } from '@epic-web/invariant'
import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { useLoaderData, type MetaFunction } from '@remix-run/react'
import { useState } from 'react'
import { Button } from '#app/components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#app/components/ui/card'
import { Icon } from '#app/components/ui/icon.tsx'
import { Input } from '#app/components/ui/input.tsx'
import { Label } from '#app/components/ui/label.tsx'
import { Separator } from '#app/components/ui/separator'
import { prisma } from '#app/utils/db.server.ts'

export async function loader({ params }: LoaderFunctionArgs) {
	const user = await prisma.user.findFirst({
		select: {
			id: true,
			member: true,
			username: true,
			transactions: {
				select: {
					date: true,
					debit: true,
					credit: true,
					note: true,
				},
			},
		},
		where: {
			username: params.username,
		},
	})

	invariantResponse(user, 'User not found', { status: 404 })

	const currentBalance = await prisma.transaction.groupBy({
		by: ['userId'],
		_sum: { debit: true, credit: true },
		where: { userId: user.id },
	})

	return json({ user, currentBalance })
}

export default function ProfileRoute() {
	const { user, currentBalance } = useLoaderData<typeof loader>()
	const { transactions } = user

	const debit = currentBalance[0]?._sum?.debit ?? 0
	const credit = currentBalance[0]?._sum?.credit ?? 0

	if (user.transactions.length === 0) {
		user.transactions.push({
			credit: 0,
			debit: 0,
			date: '2024-01-01',
			note: '2024 Starting Balance',
		})
	}
	const [editProfile, setEditProfile] = useState('')
	const toggleEditProfile = (profile: string) => {
		if (editProfile === profile) setEditProfile('')
		else setEditProfile(profile)
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Transactions</CardTitle>
				<Button variant="outline" onClick={() => toggleEditProfile('transactions')} className="pb-2">
					<Icon name="pencil-1" className="scale-125 max-md:scale-150">
						Edit Transactions
					</Icon>
				</Button>
			</CardHeader>
			<CardContent className="space-y-2">
				<CardDescription>Irrigation Account Balance</CardDescription>
				<div className="grid grid-cols-6 gap-1">
					<>
						<Label htmlFor="Date" children="Date" className="col-span-1 pr-3 text-right" />
						<Label htmlFor="Date" children="Debit" className="col-span-1 pr-3 text-right" />
						<Label htmlFor="Date" children="Credit" className="col-span-1 pr-3 text-right" />
						<Label htmlFor="Date" children="Note" className="col-span-3 pl-3" />
					</>
					{transactions.map((lineItem, i) => (
						<>
							<Input id="date" readOnly={true} className="col-span-1 text-right" defaultValue={lineItem.date} />
							<Input
								id="debit"
								readOnly={true}
								className="col-span-1 text-right"
								defaultValue={lineItem.debit?.toString() ?? ''}
							/>
							<Input
								id="credit"
								readOnly={true}
								className="col-span-1 text-right"
								defaultValue={lineItem.credit?.toString() ?? ''}
							/>
							<Input id="note" readOnly={true} className="col-span-3" defaultValue={lineItem.note ?? ''} />
						</>
					))}

					<Separator className="col-span-6 mb-1 mt-1 border-b-2 border-t-2" />

					<Input
						id="date"
						readOnly={true}
						className="col-span-1 text-right"
						defaultValue={new Date().toISOString().substring(0, 10)}
					/>
					<Input
						id="total"
						readOnly={true}
						className="col-span-2 text-right"
						defaultValue={(debit || 0) - (credit || 0)}
					/>
					<Input id="balance" readOnly={true} className="col-span-3" defaultValue="Current Balance" />
				</div>
			</CardContent>
		</Card>
	)
}

export const meta: MetaFunction<typeof loader> = ({ data, params }) => {
	const displayName = data?.user.member ?? params.username
	return [
		{ title: `Profile | ${displayName}` },
		{
			name: 'description',
			content: `Profile of ${displayName} on Clearwater Farms 1`,
		},
	]
}

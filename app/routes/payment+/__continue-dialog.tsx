import { Form } from '@remix-run/react'
import { Button } from '#app/components/ui/button.tsx'
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '#app/components/ui/dialog'
import { Icon } from '#app/components/ui/icon.tsx'

export function PaymentsDialog({
	userId,
	stripeId,
	balance,
}: {
	userId: string
	stripeId: string | null
	balance: number
}) {
	const USDollar = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button type="submit" variant="secondary" className="text-nowrap">
					<Icon name="stripe-icon" className="mr-2 scale-125" />
					{balance < 0 ? 'Make Payment' : 'Add Funds'}
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Making an Online Payment</DialogTitle>
					<DialogDescription>
						<p>
							Clearwater Farms POA uses <strong>Stripe</strong> to process online payments,
						</p>
						<p>so you will be redirected to their checkout page.</p>
						<br />
						<p>
							<strong>Stripe</strong> Payments allows for multiple types of payment options,
						</p>
						<p>but unlike Irrigation scheduling, it does not allow for fractions of units.</p>
						<br />
						{balance < 0 ? (
							<p>
								You currently owe <strong>{USDollar.format(balance * -1)}</strong>, so we will use your most recent
								history to cover your balance due, but the number of hours (<strong>quantity</strong>) can be adjusted
								before checkout.
							</p>
						) : (
							<p>
								You don't currently owe CWF, but funds can still be added. We will initialize a payment with one of each
								water source, but the number of hours (<strong>quantity</strong>) can be adjusted or removed before
								checkout.
							</p>
						)}
						<br />
						<p>
							Additionally, <strong>Stripe</strong> charges 3% plus 30¢ per successful transactions. These additional
							fees will not be added to your Irrigation balance.
						</p>
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="flex flex-row content-between justify-between sm:justify-between">
					<DialogClose asChild>
						<Button type="button" variant="secondary">
							Cancel
						</Button>
					</DialogClose>
					<Form method="POST" action="/payment">
						<input type="hidden" name="userId" value={userId} />
						<input type="hidden" name="customer" value={stripeId ?? undefined} />
						<input type="hidden" name="balance" value={balance} />
						<Button variant="secondary">
							<Icon name="stripe" className="w-20 pr-1 text-body-xl"></Icon>
						</Button>
					</Form>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

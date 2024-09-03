import { Link } from '@remix-run/react'
import { useState } from 'react'
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
import { Icon } from '#app/components/ui/icon'

export function PaymentCancelled({ open, username }: { open: boolean; username: string }) {
	const [isOpen, setOpen] = useState(open)
	return (
		<Dialog open={isOpen} onOpenChange={setOpen}>
			<DialogTrigger asChild></DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Your payment was cancelled</DialogTitle>
				</DialogHeader>
				<DialogDescription>You will not be charged.</DialogDescription>
				<DialogFooter className="sm:justify-start">
					<Button asChild variant="secondary">
						<Link prefetch="intent" to={`/member/${username}/transactions`}>
							<Icon className="text-body-md" name="reader">
								View Transactions
							</Icon>
						</Link>
					</Button>
					<DialogClose asChild>
						<Link to={`/?`}>
							<Button type="button" variant="secondary">
								Close
							</Button>
						</Link>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

import { ScheduleActionButton } from '#app/components/ScheduleActionButton'
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

export function DialogCloseSchedule({ id }: { id: string }) {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button className="min-[525px]:max-md:aspect-square min-[525px]:max-md:px-0" variant="default">
					<Icon name="lock-closed" className="scale-125 max-md:scale-150">
						<span className="max-md:hidden">Close Scheduling</span>
					</Icon>
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Finalize and Close Schedule?</DialogTitle>
					<DialogDescription>
						<p>Finalizing this schedule will create Debit transactions</p>
						<p>(hours * costPerHour) for every user who has scheduled hours for this schedule.</p>
						<p>This can only be done once.</p>
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="sm:justify-start">
					<ScheduleActionButton
						id={id}
						icon="lock-closed"
						value="close-schedule"
						text="Close Scheduling"
						variant="default"
					/>
					<DialogClose asChild>
						<Button type="button" variant="destructive">
							Cancel
						</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
